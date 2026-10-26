import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: string[]) {
    super({ statusCode: status, code, message, ...(details ? { details } : {}) }, status);
  }
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode!: number;
  @ApiProperty({ example: 'VALIDATION_ERROR' }) code!: string;
  @ApiProperty({ example: 'Entrada inválida.' }) message!: string;
  @ApiPropertyOptional({ type: [String], example: ['nickname must match /^[a-z0-9_]+$/ regular expression'] })
  details?: string[];
}

export const DocumentError = (status: number, code: string, message: string) =>
  ApiResponse({ status, description: message, type: ErrorResponseDto,
    example: { statusCode: status, code, message } });
