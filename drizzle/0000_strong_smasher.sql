CREATE TYPE "public"."account_kind" AS ENUM('cash', 'debit', 'investment', 'credit');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_status" AS ENUM('cleared', 'projected');--> statement-breakpoint
CREATE TABLE "account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"kind" "account_kind" NOT NULL,
	"opening_balance" integer DEFAULT 0 NOT NULL,
	"cutoff_day" integer,
	"payment_day" integer,
	"credit_limit" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_credit_fields" CHECK (("account"."kind" = 'credit' AND "account"."cutoff_day" IS NOT NULL AND "account"."payment_day" IS NOT NULL)
          OR ("account"."kind" <> 'credit' AND "account"."cutoff_day" IS NULL AND "account"."payment_day" IS NULL AND "account"."credit_limit" IS NULL)),
	CONSTRAINT "chk_cutoff_day_range" CHECK ("account"."cutoff_day" BETWEEN 1 AND 28),
	CONSTRAINT "chk_payment_day_range" CHECK ("account"."payment_day" BETWEEN 1 AND 28),
	CONSTRAINT "chk_cutoff_ne_payment" CHECK ("account"."cutoff_day" <> "account"."payment_day"),
	CONSTRAINT "chk_credit_limit_pos" CHECK ("account"."credit_limit" IS NULL OR "account"."credit_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_entry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "ledger_entry_kind" NOT NULL,
	"status" "ledger_entry_status" NOT NULL,
	"amount" integer NOT NULL,
	"concept" varchar(200),
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" integer NOT NULL,
	"to_account_id" integer,
	CONSTRAINT "chk_amount_positive" CHECK ("ledger_entry"."amount" > 0),
	CONSTRAINT "chk_transfer_to_account" CHECK (("ledger_entry"."kind" = 'transfer' AND "ledger_entry"."to_account_id" IS NOT NULL)
          OR ("ledger_entry"."kind" <> 'transfer' AND "ledger_entry"."to_account_id" IS NULL)),
	CONSTRAINT "chk_no_self_transfer" CHECK ("ledger_entry"."to_account_id" IS NULL OR "ledger_entry"."to_account_id" <> "ledger_entry"."account_id")
);
--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_to_account_id_account_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_is_active" ON "account" USING btree ("is_active") WHERE "account"."is_active" = TRUE;--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_account_status" ON "ledger_entry" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_occurred_at" ON "ledger_entry" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_ledger_entry_to_account" ON "ledger_entry" USING btree ("to_account_id") WHERE "ledger_entry"."to_account_id" IS NOT NULL;