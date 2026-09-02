import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

function getDialect(): 'mysql' | 'postgresql' | 'sqlite' {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  if (url.startsWith('file:') || url.startsWith('sqlite:') || url.endsWith('.db')) {
    return 'sqlite';
  }
  return 'mysql';
}

const dialect = getDialect();

const schemaMap = {
  mysql: './src/lib/db/schema/mysql.ts',
  postgresql: './src/lib/db/schema/pg.ts',
  sqlite: './src/lib/db/schema/sqlite.ts',
};

export default defineConfig({
  schema: schemaMap[dialect],
  out: `./drizzle/${dialect}`,
  dialect,
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
