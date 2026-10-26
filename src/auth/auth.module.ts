import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthController } from './auth.controller.js';
@Module({ imports: [UsersModule, JwtModule.registerAsync({ useFactory: () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET deve ter pelo menos 32 bytes. Gere um segredo local.');
  return { secret, signOptions: { algorithm: 'HS256' as const, expiresIn: 3600, issuer: 'lobbylive', audience: 'lobbylive' },
    verifyOptions: { algorithms: ['HS256' as const], issuer: 'lobbylive', audience: 'lobbylive' } };
} })], controllers: [AuthController], providers: [AuthService, AuthGuard], exports: [AuthService, AuthGuard] })
export class AuthModule {}
