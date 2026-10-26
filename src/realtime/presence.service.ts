import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error.js';
import type { Identity } from '../auth/auth.dto.js';
import type { Participant, RoomSnapshot } from './contracts.js';
interface Member {
  participant: Participant;
  active: Set<string>;
  pending: Set<string>;
}
export interface Removal { roomId: string; left?: Participant; }

@Injectable()
export class PresenceService {
  private readonly rooms = new Map<string, Map<string, Member>>();
  private readonly connections = new Map<string, Map<string, string>>();

  // Reserve synchronously before awaiting the Socket.IO adapter. Pending users consume capacity,
  // but become visible only on commit. This also handles two connections of the same account.
  reserve(roomId: string, identity: Identity, socketId: string, capacity: number): void {
    let members = this.rooms.get(roomId);
    let member = members?.get(identity.userId);
    if (!member && (members?.size ?? 0) >= capacity) {
      throw new ApiError(HttpStatus.CONFLICT, 'ROOM_FULL', 'Sala cheia.');
    }
    if (!members) { members = new Map(); this.rooms.set(roomId, members); }
    if (!member) {
      member = { participant: { userId: identity.userId, nickname: identity.nickname, joinedAt: '' }, active: new Set(), pending: new Set() };
      members.set(identity.userId, member);
    }
    if (!member.active.has(socketId)) member.pending.add(socketId);
    const subscriptions = this.connections.get(socketId) ?? new Map<string, string>();
    subscriptions.set(roomId, identity.userId);
    this.connections.set(socketId, subscriptions);
  }

  commit(roomId: string, socketId: string): { joined?: Participant } | null {
    const userId = this.connections.get(socketId)?.get(roomId);
    const member = userId ? this.rooms.get(roomId)?.get(userId) : undefined;
    if (!member) return null; // Disconnect can cancel a reservation while the adapter is awaited.
    if (member.active.has(socketId)) return {};
    if (!member.pending.delete(socketId)) return null;
    const first = member.active.size === 0;
    if (first) member.participant.joinedAt = new Date().toISOString();
    member.active.add(socketId);
    return first ? { joined: { ...member.participant } } : {};
  }

  has(roomId: string, socketId: string): boolean {
    const userId = this.connections.get(socketId)?.get(roomId);
    return !!userId && !!this.rooms.get(roomId)?.get(userId)?.active.has(socketId);
  }

  remove(roomId: string, socketId: string): Removal {
    const subscriptions = this.connections.get(socketId);
    const userId = subscriptions?.get(roomId);
    const members = this.rooms.get(roomId);
    const member = userId ? members?.get(userId) : undefined;
    subscriptions?.delete(roomId);
    if (subscriptions?.size === 0) this.connections.delete(socketId);
    if (!member) return { roomId };
    const wasActive = member.active.delete(socketId);
    member.pending.delete(socketId);
    const left = wasActive && member.active.size === 0 ? { ...member.participant } : undefined;
    if (member.active.size === 0 && member.pending.size === 0) members!.delete(userId!);
    if (members?.size === 0) this.rooms.delete(roomId);
    return { roomId, ...(left ? { left } : {}) };
  }

  removeSocket(socketId: string): Removal[] {
    return [...(this.connections.get(socketId)?.keys() ?? [])].map((roomId) => this.remove(roomId, socketId));
  }

  snapshot(roomId: string): RoomSnapshot {
    return { roomId, participants: [...(this.rooms.get(roomId)?.values() ?? [])]
      .filter((member) => member.active.size > 0).map((member) => ({ ...member.participant }))
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.userId.localeCompare(b.userId)) };
  }
}
