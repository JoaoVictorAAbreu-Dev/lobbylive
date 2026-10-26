import { randomUUID } from 'node:crypto';
import { HttpStatus, Logger } from '@nestjs/common';
import { Ack, ConnectedSocket, MessageBody, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { EntityManager } from '@mikro-orm/postgresql';
import { RequestContext } from '@mikro-orm/core';
import type { Namespace, Socket } from 'socket.io';
import { ApiError } from '../common/api-error.js';
import { AuthService } from '../auth/auth.service.js';
import type { Identity } from '../auth/auth.dto.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { PresenceService } from './presence.service.js';
import type { Removal } from './presence.service.js';
import { ChatEventDto, RoomEventDto, eventDto } from './event.dto.js';
import type { Ack as Callback, ChatMessage, ClientEvents, ServerEvents } from './contracts.js';
interface SocketData { identity: Identity; expiryTimer?: NodeJS.Timeout; }
type LobbySocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
type LobbyNamespace = Namespace<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
const channel = (roomId: string) => `room:${roomId}`;

@WebSocketGateway({ namespace: '/lobby', maxHttpBufferSize: 16384, connectionStateRecovery: undefined })
export class LobbyGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() private server!: LobbyNamespace;
  private readonly queues = new WeakMap<LobbySocket, Promise<unknown>>();
  private readonly logger = new Logger(LobbyGateway.name);
  constructor(private readonly auth: AuthService, private readonly em: EntityManager,
    private readonly rooms: RoomsService, private readonly presence: PresenceService) {}

  afterInit(server: LobbyNamespace): void {
    server.use((socket, next) => {
      void RequestContext.create(this.em, async () => {
        const identity = await this.auth.authenticate(socket.handshake.auth?.token);
        if (socket.conn.readyState !== 'open') throw new Error('Connection closed during authentication.');
        socket.data.identity = identity;
        socket.data.expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, identity.expiresAt - Date.now()));
        socket.data.expiryTimer.unref();
        // Clear the timer even if a client disappears between middleware and connection.
        socket.conn.once('close', () => clearTimeout(socket.data.expiryTimer));
      }).then(() => next(), () => {
        const error = Object.assign(new Error('Autenticação obrigatória.'), { data: { code: 'UNAUTHORIZED', message: 'Token inválido ou expirado.' } });
        next(error);
      });
    });
  }

  handleDisconnect(socket: LobbySocket): void {
    clearTimeout(socket.data.expiryTimer);
    for (const removal of this.presence.removeSocket(socket.id)) this.notifyRemoval(removal);
  }

  private assertConnected(socket: LobbySocket): Identity {
    const identity = socket.data.identity;
    if (!socket.connected || !identity || identity.expiresAt <= Date.now()) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Token inválido ou expirado.');
    }
    return identity;
  }
  private requireMember(roomId: string, socket: LobbySocket): void {
    if (!this.presence.has(roomId, socket.id)) throw new ApiError(HttpStatus.FORBIDDEN, 'NOT_IN_ROOM', 'Entre na sala primeiro.');
  }
  private notifyRemoval(removal: Removal): void {
    if (!removal.left) return;
    this.server.to(channel(removal.roomId)).emit('participant:left', { roomId: removal.roomId, participant: removal.left });
    this.server.to(channel(removal.roomId)).emit('room:participants', this.presence.snapshot(removal.roomId));
  }

  // Serialize commands per connection, while allowing different clients to compete for capacity.
  private dispatch(socket: LobbySocket, ack: Callback | undefined, operation: () => Promise<unknown>): Promise<void> {
    const previous = this.queues.get(socket) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      try {
        this.assertConnected(socket);
        const data = await RequestContext.create(this.em, operation);
        if (typeof ack === 'function') ack({ ok: true, data });
      } catch (error) {
        const failure = error instanceof ApiError ? error.getResponse() as { code: string; message: string }
          : { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' };
        if (!(error instanceof ApiError)) this.logger.error('Falha na operação em tempo real.');
        const response = { code: failure.code, message: failure.message };
        if (typeof ack === 'function') ack({ ok: false, error: response });
        else socket.emit('operation:error', response);
      }
    });
    this.queues.set(socket, current);
    return current;
  }

  @SubscribeMessage('room:join')
  join(@ConnectedSocket() socket: LobbySocket, @MessageBody() payload: unknown, @Ack() ack?: Callback) {
    return this.dispatch(socket, ack, async () => {
      const dto = await eventDto(RoomEventDto, payload);
      const room = await this.rooms.entity(dto.roomId);
      const identity = this.assertConnected(socket);
      if (this.presence.has(room.id, socket.id)) return this.presence.snapshot(room.id);
      this.presence.reserve(room.id, identity, socket.id, room.capacity);
      try {
        await socket.join(channel(room.id));
        this.assertConnected(socket);
        const result = this.presence.commit(room.id, socket.id);
        if (!result) throw new ApiError(HttpStatus.BAD_REQUEST, 'JOIN_CANCELLED', 'Entrada cancelada.');
        if (result.joined) {
          this.server.to(channel(room.id)).emit('participant:joined', { roomId: room.id, participant: result.joined });
          this.server.to(channel(room.id)).emit('room:participants', this.presence.snapshot(room.id));
        }
        return this.presence.snapshot(room.id);
      } catch (error) {
        await socket.leave(channel(room.id));
        this.notifyRemoval(this.presence.remove(room.id, socket.id));
        throw error;
      }
    });
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() socket: LobbySocket, @MessageBody() payload: unknown, @Ack() ack?: Callback) {
    return this.dispatch(socket, ack, async () => {
      const dto = await eventDto(RoomEventDto, payload);
      await this.rooms.entity(dto.roomId);
      const wasMember = this.presence.has(dto.roomId, socket.id);
      await socket.leave(channel(dto.roomId));
      this.notifyRemoval(this.presence.remove(dto.roomId, socket.id));
      return { roomId: dto.roomId, left: wasMember };
    });
  }

  @SubscribeMessage('room:participants')
  participants(@ConnectedSocket() socket: LobbySocket, @MessageBody() payload: unknown, @Ack() ack?: Callback) {
    return this.dispatch(socket, ack, async () => {
      const dto = await eventDto(RoomEventDto, payload);
      await this.rooms.entity(dto.roomId);
      this.requireMember(dto.roomId, socket);
      return this.presence.snapshot(dto.roomId);
    });
  }

  @SubscribeMessage('chat:send')
  chat(@ConnectedSocket() socket: LobbySocket, @MessageBody() payload: unknown, @Ack() ack?: Callback) {
    return this.dispatch(socket, ack, async () => {
      const dto = await eventDto(ChatEventDto, payload);
      await this.rooms.entity(dto.roomId);
      const identity = this.assertConnected(socket);
      this.requireMember(dto.roomId, socket);
      const message: ChatMessage = { id: randomUUID(), roomId: dto.roomId,
        sender: { userId: identity.userId, nickname: identity.nickname }, text: dto.text, createdAt: new Date().toISOString() };
      this.server.to(channel(dto.roomId)).emit('chat:message', message);
      return message;
    });
  }
}
