ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "cusip" text;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN IF NOT EXISTS "cusip" text;