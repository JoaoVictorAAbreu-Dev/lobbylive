import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetaDto } from '../common/pagination.dto.js';
export class CreateRoomDto {
  @ApiProperty({ example: 'Partida da noite', minLength: 3, maxLength: 60 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(3, 60) name!: string;
  @ApiPropertyOptional({ default: 8, minimum: 2, maximum: 16 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt() @Min(2) @Max(16) capacity?: number;
}
export class CreatorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nickname!: string;
}
export class RoomResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 8 }) capacity!: number;
  @ApiProperty({ example: 0 }) participantCount!: number;
  @ApiProperty({ type: CreatorDto }) creator!: CreatorDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class RoomsPageDto extends PageMetaDto {
  @ApiProperty({ type: [RoomResponseDto] }) data!: RoomResponseDto[];
}
