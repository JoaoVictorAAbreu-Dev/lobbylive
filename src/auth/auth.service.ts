import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { isUUID } from 'class-validator';
import { ApiError } from '../common/api-error.js';
import { UsersService } from '../users/users.service.js';
import type { CredentialsDto, Identity } from './auth.dto.js';

const hashOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(randomBytes(32), hashOptions);
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}
  async register(dto: CredentialsDto) {
    return this.users.create(dto.nickname, await argon2.hash(dto.password, hashOptions));
  }
  async login(dto: CredentialsDto) {
    const user = await this.users.findByNickname(dto.nickname);
    const valid = await argon2.verify(user?.passwordHash ?? await this.dummyHash, dto.password);
    if (!user || !valid) throw new ApiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), tokenType: 'Bearer', expiresIn: 3600 };
  }
  async authenticate(token: unknown): Promise<Identity> {
    if (typeof token !== 'string' || token.length > 4096) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Token inválido ou expirado.');
    }
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; exp: number }>(token);
      if (!isUUID(claims.sub) || !Number.isInteger(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error();
      const user = await this.users.findById(claims.sub);
      if (!user) throw new Error();
      return { userId: user.id, nickname: user.nickname, expiresAt: claims.exp * 1000 };
    } catch {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Token inválido ou expirado.');
    }
  }
}
