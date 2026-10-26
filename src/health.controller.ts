import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { ApiError, DocumentError } from './common/api-error.js';
class HealthDto {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 'up' }) database!: string;
}
@ApiTags('Health') @Controller('health')
export class HealthController {
  constructor(private readonly em: EntityManager) {}
  @Get() @ApiOkResponse({ type: HealthDto }) @DocumentError(503, 'DATABASE_UNAVAILABLE', 'Banco indisponível.')
  async check() {
    try { await this.em.getConnection().execute('select 1'); }
    catch { throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, 'DATABASE_UNAVAILABLE', 'Banco indisponível.'); }
    return { status: 'ok', database: 'up' };
  }
}
