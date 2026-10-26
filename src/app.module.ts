import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import config from './mikro-orm.config.js';
import { AuthModule } from './auth/auth.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { HealthController } from './health.controller.js';
@Module({ imports: [MikroOrmModule.forRoot(config), AuthModule, RoomsModule, RealtimeModule], controllers: [HealthController] })
export class AppModule {}
