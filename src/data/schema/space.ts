import {
  integer,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { mcpReadonly } from "./roles";

// A space is a VISIBILITY overlay: members expose accounts to it (space_account).
// It never owns accounts, money, or plans; its balance is the sum of exposed accounts.
export const space = pgTable(
  "space",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    // Informational metadata only — membership/authority lives in space_member,
    // so deleting the creator's auth user must not block or cascade here.
    createdBy: uuid("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("space_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type Space = typeof space.$inferSelect;
export type NewSpace = typeof space.$inferInsert;
