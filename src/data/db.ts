import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Connection pool — reused across requests in a long-running server.
// SESSION mode pooler is required for prepared statements (Supabase default: port 5432).
// The pooler caps sessions at 15; keep max low and reuse a global singleton in dev
// so HMR recompiles don't leak stale pools until EMAXCONNSESSION.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? postgres(env.DATABASE_URL_APP, { max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
