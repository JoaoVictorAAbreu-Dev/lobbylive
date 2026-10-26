import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { User } from './users/user.entity.js';
import { Room } from './rooms/room.entity.js';
const port = Number(process.env.DB_PORT ?? 5434);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT inválida.');
export default defineConfig({ entities: [User, Room], host: process.env.DB_HOST ?? '127.0.0.1', port,
  dbName: process.env.DB_NAME ?? 'lobbylive', user: process.env.DB_USER ?? 'lobbylive',
  password: process.env.DB_PASSWORD ?? 'lobbylive_local', extensions: [Migrator],
  migrations: { path: fileURLToPath(new URL('./migrations', import.meta.url)), glob: '!(*.d).{js,ts}',
    transactional: true, allOrNothing: true, snapshot: false },
  pool: { min: 0, max: 10 }, driverOptions: { connectionTimeoutMillis: 3000, statement_timeout: 10000 },
  debug: false,
});
