import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentError } from '../common/api-error.js';
import { UsersService, publicUser } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { AuthGuard, CurrentUser } from './auth.guard.js';
import { CredentialsDto, TokenResponseDto, UserResponseDto } from './auth.dto.js';
import type { Identity } from './auth.dto.js';
@ApiTags('Auth')
@DocumentError(400, 'VALIDATION_ERROR', 'Entrada inválida.')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly users: UsersService) {}
  @Post('register') @ApiOperation({ summary: 'Cadastrar conta' })
  @ApiCreatedResponse({ type: UserResponseDto }) @DocumentError(409, 'NICKNAME_TAKEN', 'Nickname já cadastrado.')
  register(@Body() dto: CredentialsDto) { return this.auth.register(dto); }
  @Post('login') @HttpCode(200) @ApiOperation({ summary: 'Entrar; token válido por uma hora' })
  @ApiOkResponse({ type: TokenResponseDto }) @DocumentError(401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.')
  login(@Body() dto: CredentialsDto) { return this.auth.login(dto); }
  @Get('me') @UseGuards(AuthGuard) @ApiBearerAuth() @ApiOkResponse({ type: UserResponseDto })
  @DocumentError(401, 'UNAUTHORIZED', 'Autenticação obrigatória.')
  async me(@CurrentUser() user: Identity) { return publicUser((await this.users.findById(user.userId))!); }
}
