import { randomUUID } from 'node:crypto';
import { Check, Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'users' })
@Check({ name: 'users_nickname_check', expression: "nickname ~ '^[a-z0-9_]{3,30}$'" })
export class User {
  @PrimaryKey({ type: 'uuid' }) id: string = randomUUID();
  @Property({ type: 'varchar', length: 30 }) @Unique({ name: 'users_nickname_unique' }) nickname!: string;
  @Property({ type: 'text', hidden: true }) passwordHash!: string;
  @Property({ type: 'timestamptz' }) createdAt: Date = new Date();
}
