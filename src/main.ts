import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';
async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(port, process.env.HOST ?? '127.0.0.1');
}
bootstrap().catch(() => { console.error('Falha ao iniciar LobbyLive. Verifique configuração e banco.'); process.exitCode = 1; });
