import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';
@Module({ imports: [MikroOrmModule.forFeature([User])], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
