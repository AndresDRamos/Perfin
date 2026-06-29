CREATE TABLE "expense_category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" varchar(300),
	"is_savings" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "income_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" varchar(300),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "income_category_id" integer;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "expense_category_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_name_lower_uq" ON "expense_category" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_savings_singleton" ON "expense_category" USING btree ("is_savings") WHERE "expense_category"."is_savings" = TRUE;--> statement-breakpoint
CREATE INDEX "idx_expense_category_is_active" ON "expense_category" USING btree ("is_active") WHERE "expense_category"."is_active" = TRUE;--> statement-breakpoint
CREATE UNIQUE INDEX "income_category_name_lower_uq" ON "income_category" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_income_category_is_active" ON "income_category" USING btree ("is_active") WHERE "income_category"."is_active" = TRUE;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_income_category_id_income_category_id_fk" FOREIGN KEY ("income_category_id") REFERENCES "public"."income_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_income_category" ON "ledger_entry" USING btree ("income_category_id") WHERE "ledger_entry"."income_category_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_expense_category" ON "ledger_entry" USING btree ("expense_category_id") WHERE "ledger_entry"."expense_category_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "chk_category_kind" CHECK (
        ("ledger_entry"."kind" = 'income' AND "ledger_entry"."expense_category_id" IS NULL)
        OR ("ledger_entry"."kind" = 'expense' AND "ledger_entry"."income_category_id" IS NULL)
        OR ("ledger_entry"."kind" = 'transfer' AND "ledger_entry"."income_category_id" IS NULL AND "ledger_entry"."expense_category_id" IS NULL)
      );--> statement-breakpoint
INSERT INTO "expense_category" ("name", "description", "is_savings", "is_active")
VALUES ('Ahorro', 'Categoría reservada para metas de ahorro', true, true)
ON CONFLICT DO NOTHING;