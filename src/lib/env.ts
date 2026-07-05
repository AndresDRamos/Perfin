import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida de Postgres"),
  DATABASE_URL_APP: z.string().url("DATABASE_URL_APP debe ser una URL válida de Postgres"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY es requerida"),
  // Server-only — never expose to the client. Used by auth-write to create
  // users via the Admin API (email_confirm bypass for the synthetic-email path).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY es requerida"),
  // Base URL email links redirect back to (/auth/confirm). Must also be
  // registered in Supabase Auth → URL Configuration → Redirect URLs.
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

// Validated at import time — server-side only. Never import from client components.
export const env = envSchema.parse(process.env);
