import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ApiError } from '../common/api-error.js';
import { PaginationDto, pageResult } from '../common/pagination.dto.js';
import { User } from '../users/user.entity.js';
import { PresenceService } from '../realtime/presence.service.js';
import { Room } from './room.entity.js';
import type { CreateRoomDto } from './room.dto.js';
@Injectable()
export class RoomsService {
  constructor(private readonly em: EntityManager, private readonly presence: PresenceService) {}
  private response(room: Room) {
    return { id: room.id, name: room.name, capacity: room.capacity,
      participantCount: this.presence.snapshot(room.id).participants.length,
      creator: { id: room.creator.id, nickname: room.creator.nickname }, createdAt: room.createdAt.toISOString() };
  }
  async create(dto: CreateRoomDto, userId: string) {
    const creator = await this.em.findOneOrFail(User, { id: userId });
    const room = new Room();
    room.name = dto.name; room.capacity = dto.capacity ?? 8; room.creator = creator;
    this.em.persist(room); await this.em.flush();
    return this.response(room);
  }
  async list(query: PaginationDto) {
    const [rooms, total] = await this.em.findAndCount(Room, {}, { populate: ['creator'],
      orderBy: { createdAt: 'desc', id: 'desc' }, limit: query.limit, offset: query.offset });
    return pageResult(rooms.map((room) => this.response(room)), total, query);
  }
  async entity(id: string) {
    const room = await this.em.findOne(Room, { id }, { populate: ['creator'] });
    if (!room) throw new ApiError(HttpStatus.NOT_FOUND, 'ROOM_NOT_FOUND', 'Sala não encontrada.');
    return room;
  }
  async find(id: string) { return this.response(await this.entity(id)); }
}
