import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@shared/schema';

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATA_STORAGE || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATA_STORAGE or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle({ client: pool, schema });
