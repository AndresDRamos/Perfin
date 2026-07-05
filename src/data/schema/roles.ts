import { pgRole } from "drizzle-orm/pg-core";

// Read-only role used by the db MCP (dba / docs-sync agents). Created outside
// migrations; declared .existing() so drizzle-kit never tries to manage it.
// RLS is enabled on every public table (fail-closed for non-owner roles — the
// app connects as the table owner and bypasses it), so this role needs an
// explicit SELECT policy per table or it sees every table as empty.
export const mcpReadonly = pgRole("mcp_readonly").existing();
