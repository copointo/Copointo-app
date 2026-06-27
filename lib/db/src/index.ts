import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL.replace(
  "?sslmode=require",
  "?sslmode=no-verify",
);

export const pool = new Pool({
  connectionString,
  ssl: false,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
