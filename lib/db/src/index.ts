import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep TCP connections alive so Windows/firewall don't silently drop them
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Retire idle connections after 30 s — before the OS or PG server closes them
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Prevent unhandled 'error' events from crashing the process when a pooled
// connection is closed unexpectedly (e.g. PostgreSQL restart on Windows).
pool.on("error", (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  // Only log if there's a logger available — avoids circular import at startup
  console.error("[db-pool] idle client error:", msg);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
