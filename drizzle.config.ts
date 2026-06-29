import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/data/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use the Direct Connection URL (db.[ref].supabase.co:5432) for migrations.
    // The Session Pooler URL (pooler.supabase.com:5432) can drop long-running DDL connections.
    url: process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL!,
  },
});
