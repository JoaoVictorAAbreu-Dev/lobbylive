import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CredentialsDto {
  @ApiProperty({ example: 'player_one', minLength: 3, maxLength: 30, pattern: '^[a-z0-9_]+$' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString() @Length(3, 30) @Matches(/^[a-z0-9_]+$/) nickname!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true, format: 'password' })
  @IsString() @Length(12, 128) password!: string;
}
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'player_one' }) nickname!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class TokenResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
  @ApiProperty({ example: 3600 }) expiresIn!: number;
}
export interface Identity { userId: string; nickname: string; expiresAt: number; }
