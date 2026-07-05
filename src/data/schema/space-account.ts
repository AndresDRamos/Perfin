import {
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { account } from "./account";
import { mcpReadonly } from "./roles";
import { space } from "./space";

// "Member X exposes account Y to space Z". Pure visibility — ownership stays on
// account.user_id. Invariant (enforced in space-write, not by trigger): the
// account's owner must be a member of the space; leaving a space removes the
// member's rows here.
export const spaceAccount = pgTable(
  "space_account",
  {
    spaceId: integer("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    sharedBy: uuid("shared_by")
      .notNull()
      .references(() => authUsers.id),
    sharedAt: timestamp("shared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.accountId] }),
    // "Which spaces is this account exposed in" — needed when deactivating an account.
    index("idx_space_account_account_id").on(t.accountId),
    pgPolicy("space_account_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type SpaceAccount = typeof spaceAccount.$inferSelect;
export type NewSpaceAccount = typeof spaceAccount.$inferInsert;
