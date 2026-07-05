import {
  boolean,
  check,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { mcpReadonly } from "./roles";

export const profile = pgTable(
  "profile",
  {
    // 1:1 strict with auth.users — the auth user IS the identity, profile extends it.
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 30 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    // Mirror of auth.users.email — what signInWithPassword actually receives.
    // Synthetic (<username>@users.perfin.internal) when the user registered without one.
    loginEmail: varchar("login_email", { length: 255 }).notNull(),
    hasRealEmail: boolean("has_real_email").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Lowercase alphanumerics + underscore, 3-30 chars — keeps the synthetic
    // email derivation (<username>@users.perfin.internal) trivially valid.
    check("chk_username_format", sql`${t.username} ~ '^[a-z0-9_]{3,30}$'`),
    uniqueIndex("profile_username_lower_uq").on(sql`lower(${t.username})`),
    uniqueIndex("profile_login_email_lower_uq").on(sql`lower(${t.loginEmail})`),
    pgPolicy("profile_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type Profile = typeof profile.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
