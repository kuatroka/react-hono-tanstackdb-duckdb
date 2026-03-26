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
ALTER TABLE "cusip_quarter_investor_activity" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'public.cusip_quarter_investor_activity'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE "cusip_quarter_investor_activity" ADD PRIMARY KEY ("id")';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cusip_quarter_investor_activity_detail" (
  "id" bigint,
  "cusip" varchar,
  "ticker" varchar,
  "quarter" varchar,
  "cik" bigint,
  "did_open" boolean,
  "did_add" boolean,
  "did_reduce" boolean,
  "did_close" boolean,
  "did_hold" boolean
);
--> statement-breakpoint
ALTER TABLE "cusip_quarter_investor_activity_detail" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'public.cusip_quarter_investor_activity_detail'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE "cusip_quarter_investor_activity_detail" ADD PRIMARY KEY ("id")';
  END IF;
END $$;
