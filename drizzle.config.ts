import { defineConfig } from "drizzle-kit";

const connectionString = process.env.SUPABASE_DATA_STORAGE || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DATA_STORAGE or DATABASE_URL must be set. Ensure the database is provisioned.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  },
});
