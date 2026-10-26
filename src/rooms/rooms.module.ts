import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module.js';
import { PresenceModule } from '../realtime/presence.module.js';
import { Room } from './room.entity.js';
import { RoomsService } from './rooms.service.js';
import { RoomsController } from './rooms.controller.js';
@Module({ imports: [AuthModule, PresenceModule, MikroOrmModule.forFeature([Room])], providers: [RoomsService],
  controllers: [RoomsController], exports: [RoomsService] })
export class RoomsModule {}
