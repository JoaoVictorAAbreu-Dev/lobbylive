import { Migration } from '@mikro-orm/migrations';
export class Migration20261026000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table users (
      id uuid not null primary key, nickname varchar(30) not null, password_hash text not null, created_at timestamptz not null,
      constraint users_nickname_unique unique (nickname),
      constraint users_nickname_check check (nickname ~ '^[a-z0-9_]{3,30}$')
    );`);
    this.addSql(`create table rooms (
      id uuid not null primary key, name varchar(60) not null, capacity integer not null default 8, creator_id uuid not null, created_at timestamptz not null,
      constraint rooms_capacity_check check (capacity between 2 and 16),
      constraint rooms_name_check check (char_length(name) >= 3 and char_length(name) <= 60),
      constraint rooms_creator_id_foreign foreign key (creator_id) references users(id) on update cascade on delete restrict
    );`);
    this.addSql('create index rooms_creator_id_index on rooms (creator_id);');
    this.addSql('create index rooms_created_idx on rooms (created_at, id);');
  }
  override async down(): Promise<void> { this.addSql('drop table rooms;'); this.addSql('drop table users;'); }
}
