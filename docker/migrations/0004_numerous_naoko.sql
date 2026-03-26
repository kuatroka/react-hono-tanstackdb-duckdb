
CREATE TABLE IF NOT EXISTS "medium" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text,
	"medium_id" text,
	"body" text NOT NULL,
	"labels" text[] NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"partner" boolean NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_sender_id_user_id_fk'
  ) THEN
    EXECUTE 'ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_medium_id_medium_id_fk'
  ) THEN
    EXECUTE 'ALTER TABLE "message" ADD CONSTRAINT "message_medium_id_medium_id_fk" FOREIGN KEY ("medium_id") REFERENCES "public"."medium"("id") ON DELETE no action ON UPDATE no action';
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_medium_name" ON "medium" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_message_timestamp" ON "message" USING btree ("timestamp" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_name" ON "user" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assets_asset_name" ON "assets" USING btree ("asset_name","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_counters_id" ON "counters" USING btree ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_category" ON "entities" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_name" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_searches_category" ON "searches" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_searches_name" ON "searches" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_searches_code" ON "searches" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_superinvestors_cik_name" ON "superinvestors" USING btree ("cik_name","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_counters_user_id" ON "user_counters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_value_quarters_quarter" ON "value_quarters" USING btree ("quarter");
