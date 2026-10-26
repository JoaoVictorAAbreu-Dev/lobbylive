import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import type { Identity } from '../auth/auth.dto.js';
import { DocumentError } from '../common/api-error.js';
import { PaginationDto } from '../common/pagination.dto.js';
import { CreateRoomDto, RoomResponseDto, RoomsPageDto } from './room.dto.js';
import { RoomsService } from './rooms.service.js';
@ApiTags('Rooms') @ApiBearerAuth() @UseGuards(AuthGuard)
@DocumentError(401, 'UNAUTHORIZED', 'Autenticação obrigatória.')
@DocumentError(400, 'VALIDATION_ERROR', 'Entrada inválida.')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}
  @Post() @ApiCreatedResponse({ type: RoomResponseDto })
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: Identity) { return this.rooms.create(dto, user.userId); }
  @Get() @ApiOkResponse({ type: RoomsPageDto })
  list(@Query() query: PaginationDto) { return this.rooms.list(query); }
  @Get(':id') @ApiOkResponse({ type: RoomResponseDto }) @DocumentError(404, 'ROOM_NOT_FOUND', 'Sala não encontrada.')
  find(@Param('id', new ParseUUIDPipe()) id: string) { return this.rooms.find(id); }
}
