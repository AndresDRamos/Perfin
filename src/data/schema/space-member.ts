import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { mcpReadonly } from "./roles";
import { space } from "./space";

export const spaceRoleEnum = pgEnum("space_role", ["owner", "member"]);

export const spaceMember = pgTable(
  "space_member",
  {
    spaceId: integer("space_id")
      .notNull()
      .references(() => space.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: spaceRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.userId] }),
    // "Which spaces does this user belong to" — resolved on every request once
    // space views exist; the composite PK only covers the space→members direction.
    index("idx_space_member_user_id").on(t.userId),
    pgPolicy("space_member_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type SpaceMember = typeof spaceMember.$inferSelect;
export type NewSpaceMember = typeof spaceMember.$inferInsert;
