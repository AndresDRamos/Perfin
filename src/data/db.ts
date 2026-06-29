import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Connection pool — reused across requests in a long-running server.
// SESSION mode pooler is required for prepared statements (Supabase default: port 5432).
const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
