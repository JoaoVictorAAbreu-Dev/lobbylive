import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { ApiError } from '../common/api-error.js';
import { User } from './user.entity.js';

export const publicUser = (user: User) => ({ id: user.id, nickname: user.nickname, createdAt: user.createdAt.toISOString() });

@Injectable()
export class UsersService {
  constructor(private readonly em: EntityManager) {}
  findByNickname(nickname: string) { return this.em.findOne(User, { nickname }); }
  findById(id: string) { return this.em.findOne(User, { id }); }
  async create(nickname: string, passwordHash: string) {
    const user = new User();
    user.nickname = nickname;
    user.passwordHash = passwordHash;
    this.em.persist(user);
    try { await this.em.flush(); }
    catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ApiError(HttpStatus.CONFLICT, 'NICKNAME_TAKEN', 'Nickname já cadastrado.');
      }
      throw error;
    }
    return publicUser(user);
  }
}
