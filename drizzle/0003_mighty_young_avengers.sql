ALTER TABLE "account" ADD COLUMN "bank" varchar(100);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "number" varchar(30);--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "expiration_date" date;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "chk_number_masked" CHECK ("account"."number" IS NULL OR "account"."number" !~ '^[0-9]{13,19}$');