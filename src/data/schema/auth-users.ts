import { pgSchema, uuid } from "drizzle-orm/pg-core";

// Supabase-managed schema. Declared ONLY so public tables can FK to auth.users;
// drizzle-kit never manages it (schemaFilter: ["public"] in drizzle.config.ts).
export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});
