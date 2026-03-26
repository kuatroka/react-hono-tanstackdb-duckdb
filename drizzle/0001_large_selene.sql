ALTER TABLE "cusip_quarter_investor_activity" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
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