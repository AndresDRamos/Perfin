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
    // The username IS the visible name app-wide (display_name dropped in 0005).
    username: varchar("username", { length: 30 }).notNull(),
    // Mirror of auth.users.email — what signInWithPassword actually receives.
    // Synthetic (<username>@users.perfin.internal) when the user registered without one.
    loginEmail: varchar("login_email", { length: 255 }).notNull(),
    hasRealEmail: boolean("has_real_email").notNull().default(false),
    // App-owned proof of mailbox possession. auth.users.email_confirmed_at is
    // force-sealed at signup (Admin API, email_confirm: true — ADR-006), so it
    // proves nothing; this is set only when the user consumes a verification or
    // email-change link. NULL = unverified.
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Lowercase alphanumerics + underscore, 3-30 chars — keeps the synthetic
    // email derivation (<username>@users.perfin.internal) trivially valid.
    check("chk_username_format", sql`${t.username} ~ '^[a-z0-9_]{3,30}$'`),
    // Only real emails can be verified; any UPDATE dropping has_real_email must
    // clear email_verified_at in the same statement or the DB rejects it.
    check(
      "chk_email_verified_real",
      sql`${t.emailVerifiedAt} IS NULL OR ${t.hasRealEmail}`
    ),
    // has_real_email <=> login_email domain is not the synthetic placeholder.
    check(
      "chk_login_email_domain",
      sql`(${t.hasRealEmail} AND ${t.loginEmail} NOT LIKE '%@users.perfin.internal') OR (NOT ${t.hasRealEmail} AND ${t.loginEmail} LIKE '%@users.perfin.internal')`
    ),
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
