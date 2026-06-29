import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida de Postgres"),
  DATABASE_URL_APP: z.string().url("DATABASE_URL_APP debe ser una URL válida de Postgres"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// Validated at import time — server-side only. Never import from client components.
export const env = envSchema.parse(process.env);
