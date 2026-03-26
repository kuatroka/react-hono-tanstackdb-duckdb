CREATE TABLE IF NOT EXISTS "activity_summary" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cusip" text,
	"ticker" text,
	"quarter" text NOT NULL,
	"opened" integer DEFAULT 0,
	"closed" integer DEFAULT 0,
	"added" integer DEFAULT 0,
	"reduced" integer DEFAULT 0,
	"held" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cik_quarterly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"quarter" text NOT NULL,
	"quarter_end_date" date,
	"total_value" numeric(20, 2),
	"total_value_prc_chg" numeric(10, 4),
	"num_assets" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drilldown_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cusip" text NOT NULL,
	"ticker" text NOT NULL,
	"quarter" text NOT NULL,
	"cik" text NOT NULL,
	"cik_name" text,
	"action" text,
	"shares" numeric(20, 0),
	"value" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_check" CHECK ("drilldown_activity"."action" IN ('open', 'add', 'reduce', 'close', 'hold'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investor_flow" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"quarter" text NOT NULL,
	"inflow" numeric(20, 2),
	"outflow" numeric(20, 2)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_summary_cusip" ON "activity_summary" USING btree ("cusip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_summary_quarter" ON "activity_summary" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_summary_ticker" ON "activity_summary" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cik_quarterly_cik" ON "cik_quarterly" USING btree ("cik");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cik_quarterly_quarter" ON "cik_quarterly" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_drilldown_cik" ON "drilldown_activity" USING btree ("cik");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_drilldown_cusip" ON "drilldown_activity" USING btree ("cusip");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_drilldown_cusip_quarter" ON "drilldown_activity" USING btree ("cusip","quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_drilldown_quarter" ON "drilldown_activity" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_investor_flow_quarter" ON "investor_flow" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_investor_flow_ticker" ON "investor_flow" USING btree ("ticker");
