import path from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@/db/schema";

// Defaults match the postgres service in the kit's docker-compose.yml (local dev, 127.0.0.1 only).
export const DATABASE_URL = process.env.DATABASE_URL || "postgres://gmaps:gmaps@127.0.0.1:5433/gmaps";

export type Db = NodePgDatabase<typeof schema>;

// Kept on globalThis so Next's dev reloads reuse one pool instead of opening a new one each time.
const g = globalThis as unknown as { __pool?: Pool; __db?: Promise<Db> };

export const pgPool = () => (g.__pool ??= new Pool({ connectionString: DATABASE_URL, max: 10 }));

/** Connected Drizzle client. The first call applies any pending migrations from ./drizzle. */
export function db(): Promise<Db> {
  if (!g.__db) {
    g.__pool ??= new Pool({ connectionString: DATABASE_URL, max: 10 });
    const d = drizzle(g.__pool, { schema });
    g.__db = migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") })
      .then(() => d)
      .catch((e) => { g.__db = undefined; throw e; });
  }
  return g.__db;
}

