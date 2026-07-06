CREATE TABLE "fixed_expense" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fixed_expense_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"account_id" integer NOT NULL,
	"expense_category_id" integer NOT NULL,
	"day_of_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_fixed_expense_amount_positive" CHECK ("fixed_expense"."amount" > 0),
	CONSTRAINT "chk_fixed_expense_day_range" CHECK ("fixed_expense"."day_of_month" BETWEEN 1 AND 31),
	CONSTRAINT "chk_fixed_expense_period_order" CHECK ("fixed_expense"."end_date" IS NULL OR "fixed_expense"."end_date" >= "fixed_expense"."start_date")
);
--> statement-breakpoint
ALTER TABLE "fixed_expense" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_category" ADD COLUMN "is_fixed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "fixed_expense_id" integer;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "fixed_expense_month" date;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "expected_amount" integer;--> statement-breakpoint
ALTER TABLE "fixed_expense" ADD CONSTRAINT "fixed_expense_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expense" ADD CONSTRAINT "fixed_expense_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expense" ADD CONSTRAINT "fixed_expense_expense_category_id_expense_category_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fixed_expense_user_active" ON "fixed_expense" USING btree ("user_id") WHERE "fixed_expense"."is_active" = TRUE;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_fixed_expense_id_fixed_expense_id_fk" FOREIGN KEY ("fixed_expense_id") REFERENCES "public"."fixed_expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ledger_entry_fixed_expense_month" ON "ledger_entry" USING btree ("fixed_expense_id","fixed_expense_month") WHERE "ledger_entry"."fixed_expense_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "chk_expense_category_savings_fixed_excl" CHECK (NOT ("expense_category"."is_savings" AND "expense_category"."is_fixed"));--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "chk_fixed_expense_link" CHECK ("ledger_entry"."fixed_expense_id" IS NULL
          OR ("ledger_entry"."kind" = 'expense' AND "ledger_entry"."fixed_expense_month" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "chk_fixed_expense_month_day1" CHECK ("ledger_entry"."fixed_expense_month" IS NULL OR EXTRACT(DAY FROM "ledger_entry"."fixed_expense_month") = 1);--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "chk_expected_amount_income" CHECK ("ledger_entry"."expected_amount" IS NULL OR ("ledger_entry"."kind" = 'income' AND "ledger_entry"."expected_amount" > 0));--> statement-breakpoint
CREATE POLICY "fixed_expense_select_mcp_readonly" ON "fixed_expense" AS PERMISSIVE FOR SELECT TO "mcp_readonly" USING (true);--> statement-breakpoint
-- Hand-added (convención CLAUDE.md): la policy sola no basta sin GRANT — sin
-- esto el MCP db ve la tabla vacía (filas, no solo esquema, desaparecen).
GRANT SELECT ON TABLE "fixed_expense" TO "mcp_readonly";--> statement-breakpoint
-- Hand-added: seeds de categorías para gastos fijos (editables, no reservadas).
-- Target explícito contra el unique de expresión lower(name): solo absorbe la
-- colisión de nombre, no enmascara otras violaciones (cf. 0001 'Ahorro').
INSERT INTO "expense_category" ("name", "description", "is_fixed", "is_active")
VALUES
  ('Servicios', 'Gastos fijos de servicios (luz, agua, internet, etc.)', true, true),
  ('Subscripciones', 'Gastos fijos de subscripciones recurrentes', true, true)
ON CONFLICT (lower("name")) DO NOTHING;