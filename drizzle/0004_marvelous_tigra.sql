-- auth schema + auth.users are Supabase-managed and already exist; the generated
-- CREATE SCHEMA/CREATE TABLE statements were removed by hand (they live only in
-- the snapshot so drizzle-kit can resolve the FKs below).
CREATE TYPE "public"."space_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(30) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"login_email" varchar(255) NOT NULL,
	"has_real_email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_username_format" CHECK ("profile"."username" ~ '^[a-z0-9_]{3,30}$')
);
--> statement-breakpoint
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "space" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "space_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "space_member" (
	"space_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "space_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_member_space_id_user_id_pk" PRIMARY KEY("space_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "space_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "space_account" (
	"space_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_account_space_id_account_id_pk" PRIMARY KEY("space_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "space_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "budget" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "income_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ledger_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "idx_ledger_entry_account_status";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_member" ADD CONSTRAINT "space_member_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_member" ADD CONSTRAINT "space_member_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_account" ADD CONSTRAINT "space_account_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_account" ADD CONSTRAINT "space_account_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_account" ADD CONSTRAINT "space_account_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_username_lower_uq" ON "profile" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "profile_login_email_lower_uq" ON "profile" USING btree (lower("login_email"));--> statement-breakpoint
CREATE INDEX "idx_space_member_user_id" ON "space_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_space_account_account_id" ON "space_account" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_user_account_status" ON "ledger_entry" USING btree ("user_id","account_id","status");--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_user_occurred_at" ON "ledger_entry" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_plan_user_id" ON "plan" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "account_select_mcp_readonly" ON "account" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "budget_select_mcp_readonly" ON "budget" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "expense_category_select_mcp_readonly" ON "expense_category" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "income_category_select_mcp_readonly" ON "income_category" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "ledger_entry_select_mcp_readonly" ON "ledger_entry" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "plan_select_mcp_readonly" ON "plan" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "profile_select_mcp_readonly" ON "profile" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "space_select_mcp_readonly" ON "space" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "space_member_select_mcp_readonly" ON "space_member" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
CREATE POLICY "space_account_select_mcp_readonly" ON "space_account" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
-- Hand-added: table grants are not managed by drizzle-kit. The policies above
-- control row visibility; this grants the base SELECT privilege on new tables.
GRANT SELECT ON "profile", "space", "space_member", "space_account" TO "mcp_readonly";