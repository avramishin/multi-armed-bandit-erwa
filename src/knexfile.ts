import type { Knex } from 'knex';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'app.db');

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(process.cwd(), 'src', 'database', 'migrations'),
    extension: 'ts',
  },
};

export default config;
