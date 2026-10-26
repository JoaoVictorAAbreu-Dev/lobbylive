import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiError } from './common/api-error.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true,
    exceptionFactory: (errors) => new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Entrada inválida.',
      errors.flatMap((error) => Object.values(error.constraints ?? {}))) }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('LobbyLive').setVersion('1.0.0')
    .setDescription('Salas persistentes e presença/chat em tempo real. Contrato Socket.IO em docs/EVENTS.md.').addBearerAuth().build());
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: '/docs-json' });
}
