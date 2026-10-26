import { CanActivate, createParamDecorator, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../common/api-error.js';
import { AuthService } from './auth.service.js';
import type { Identity } from './auth.dto.js';
export interface AuthRequest extends Request { user: Identity; }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^ ]+)$/.exec(request.headers.authorization ?? '');
    if (!match) throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Autenticação obrigatória.');
    request.user = await this.auth.authenticate(match[1]);
    return true;
  }
}
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<AuthRequest>().user);
