CREATE TYPE "public"."income_frequency" AS ENUM('weekly', 'biweekly', 'semimonthly', 'monthly');--> statement-breakpoint
CREATE TABLE "income_schedule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "income_schedule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"frequency" "income_frequency" NOT NULL,
	"estimated_amount" integer NOT NULL,
	"account_id" integer NOT NULL,
	"income_category_id" integer,
	"anchor_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_income_schedule_amount_pos" CHECK ("income_schedule"."estimated_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "income_schedule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "income_schedule" ADD CONSTRAINT "income_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_schedule" ADD CONSTRAINT "income_schedule_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_schedule" ADD CONSTRAINT "income_schedule_income_category_id_income_category_id_fk" FOREIGN KEY ("income_category_id") REFERENCES "public"."income_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_income_schedule_user_active" ON "income_schedule" USING btree ("user_id") WHERE "income_schedule"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_income_schedule_user_id" ON "income_schedule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_income_schedule_account_id" ON "income_schedule" USING btree ("account_id");--> statement-breakpoint
CREATE POLICY "income_schedule_select_mcp_readonly" ON "income_schedule" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
GRANT SELECT ON "income_schedule" TO "mcp_readonly";