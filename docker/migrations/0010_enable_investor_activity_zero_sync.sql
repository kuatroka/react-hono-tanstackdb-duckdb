DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'serving'
      AND table_name = 'cusip_quarter_investor_activity'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM serving.cusip_quarter_investor_activity
      WHERE id IS NULL
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Cannot enable Zero sync for serving.cusip_quarter_investor_activity: id contains NULL values';
    END IF;

    IF EXISTS (
      SELECT id
      FROM serving.cusip_quarter_investor_activity
      GROUP BY id
      HAVING COUNT(*) > 1
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Cannot enable Zero sync for serving.cusip_quarter_investor_activity: duplicate id values detected';
    END IF;

    EXECUTE 'ALTER TABLE serving.cusip_quarter_investor_activity ALTER COLUMN id SET NOT NULL';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE contype = 'p'
        AND conrelid = 'serving.cusip_quarter_investor_activity'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE serving.cusip_quarter_investor_activity ADD PRIMARY KEY (id)';
    END IF;
  END IF;
END $$;
