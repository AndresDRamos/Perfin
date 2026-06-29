CREATE TYPE "public"."budget_subtype" AS ENUM('category_cap', 'savings_reservation', 'purchase_goal');--> statement-breakpoint
CREATE TYPE "public"."purchase_horizon" AS ENUM('short', 'medium', 'long');--> statement-breakpoint
CREATE TABLE "budget" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "budget_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer NOT NULL,
	"subtype" "budget_subtype" NOT NULL,
	"target_amount" integer NOT NULL,
	"period_start" date,
	"period_end" date,
	"expense_category_id" integer,
	"account_id" integer,
	"item_name" varchar(100),
	"horizon" "purchase_horizon",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_budget_target_positive" CHECK ("budget"."target_amount" > 0),
	CONSTRAINT "chk_budget_period_pair" CHECK (("budget"."period_start" IS NULL AND "budget"."period_end" IS NULL)
          OR ("budget"."period_start" IS NOT NULL AND "budget"."period_end" IS NOT NULL AND "budget"."period_end" >= "budget"."period_start")),
	CONSTRAINT "chk_budget_subtype_fields" CHECK (
        ("budget"."subtype" = 'category_cap' AND "budget"."expense_category_id" IS NOT NULL AND "budget"."account_id" IS NULL AND "budget"."item_name" IS NULL AND "budget"."horizon" IS NULL)
        OR ("budget"."subtype" = 'savings_reservation' AND "budget"."account_id" IS NOT NULL AND "budget"."expense_category_id" IS NULL AND "budget"."item_name" IS NULL AND "budget"."horizon" IS NULL)
        OR ("budget"."subtype" = 'purchase_goal' AND "budget"."item_name" IS NOT NULL AND "budget"."horizon" IS NOT NULL AND "budget"."expense_category_id" IS NULL AND "budget"."account_id" IS NULL)
      )
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_plan_period_order" CHECK ("plan"."period_end" >= "plan"."period_start")
);
--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_budget_plan_id" ON "budget" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_budget_expense_category" ON "budget" USING btree ("expense_category_id") WHERE "budget"."expense_category_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_budget_account" ON "budget" USING btree ("account_id") WHERE "budget"."account_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_cap_category_uq" ON "budget" USING btree ("plan_id","expense_category_id") WHERE "budget"."subtype" = 'category_cap';--> statement-breakpoint
CREATE UNIQUE INDEX "budget_reservation_account_uq" ON "budget" USING btree ("plan_id","account_id") WHERE "budget"."subtype" = 'savings_reservation';