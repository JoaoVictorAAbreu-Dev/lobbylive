import { plainToInstance, Transform } from 'class-transformer';
import { IsString, IsUUID, Length, validate } from 'class-validator';
import { HttpStatus } from '@nestjs/common';
import { ApiError } from '../common/api-error.js';
export class RoomEventDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.toLowerCase() : value)
  @IsUUID() roomId!: string;
}
export class ChatEventDto extends RoomEventDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 500) text!: string;
}
export async function eventDto<T extends object>(type: new () => T, payload: unknown): Promise<T> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Evento inválido.');
  }
  const dto = plainToInstance(type, payload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
  if (errors.length) throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Evento inválido.');
  return dto;
}
