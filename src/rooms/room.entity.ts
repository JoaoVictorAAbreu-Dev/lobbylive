import { randomUUID } from 'node:crypto';
import { Check, Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { User } from '../users/user.entity.js';
@Entity({ tableName: 'rooms' })
@Check({ name: 'rooms_capacity_check', expression: 'capacity between 2 and 16' })
@Check({ name: 'rooms_name_check', expression: 'char_length(name) >= 3 and char_length(name) <= 60' })
@Index({ name: 'rooms_created_idx', properties: ['createdAt', 'id'] })
export class Room {
  @PrimaryKey({ type: 'uuid' }) id: string = randomUUID();
  @Property({ type: 'varchar', length: 60 }) name!: string;
  @Property({ type: 'integer' }) capacity: number = 8;
  @ManyToOne(() => User, { deleteRule: 'restrict', updateRule: 'cascade', index: true }) creator!: User;
  @Property({ type: 'timestamptz' }) createdAt: Date = new Date();
}
