import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from './api-error.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof ApiError) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      response.status(status).json({ statusCode: status,
        code: status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
        message: Array.isArray(message) ? 'Entrada inválida.' : message ?? exception.message,
        ...(Array.isArray(message) ? { details: message } : {}),
      });
      return;
    }
    this.logger.error('Falha interna na requisição.', exception instanceof Error ? exception.stack : undefined);
    response.status(500).json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' });
  }
}
