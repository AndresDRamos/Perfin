import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/data/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DATABASE_URL_MIGRATE points to the Session Pooler (postgres user): the Direct
    // Connection URL is IPv6-only and unreachable on this network. Fine for this
    // project's small additive migrations; for very long-running DDL, run from a
    // network with IPv6 using the direct URL (kept commented in .env).
    url: process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL!,
  },
});
