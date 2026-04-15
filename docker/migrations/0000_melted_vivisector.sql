CREATE TABLE IF NOT EXISTS "assets" (
	"id" bigint PRIMARY KEY NOT NULL,
	"asset" text NOT NULL,
	"asset_name" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "counters" (
	"id" text PRIMARY KEY NOT NULL,
	"value" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cusip_quarter_investor_activity" (
	"id" bigint,
	"cusip" varchar,
	"ticker" varchar,
	"quarter" varchar,
	"num_open" bigint,
	"num_add" bigint,
	"num_reduce" bigint,
	"num_close" bigint,
	"num_hold" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"value" numeric(15, 2),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "category_check" CHECK ("entities"."category" IN ('investor', 'asset'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "periods" (
	"id" bigint PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	CONSTRAINT "periods_period_unique" UNIQUE("period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "searches" (
	"id" bigint PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"category" text NOT NULL,
	CONSTRAINT "searches_category_check" CHECK ("searches"."category" IN ('superinvestors', 'assets', 'periods'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "superinvestors" (
	"id" bigint PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"cik_name" text,
	"cik_ticker" text,
	"active_periods" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_counters" (
	"user_id" text PRIMARY KEY NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "value_quarters" (
	"quarter" text PRIMARY KEY NOT NULL,
	"value" double precision NOT NULL
);
