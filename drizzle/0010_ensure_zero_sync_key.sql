DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'cusip_quarter_investor_activity_detail'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.cusip_quarter_investor_activity_detail
      WHERE id IS NULL
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Cannot enable Zero sync for public.cusip_quarter_investor_activity_detail: id contains NULL values';
    END IF;

    IF EXISTS (
      SELECT id
      FROM public.cusip_quarter_investor_activity_detail
      GROUP BY id
      HAVING COUNT(*) > 1
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Cannot enable Zero sync for public.cusip_quarter_investor_activity_detail: duplicate id values detected';
    END IF;

    EXECUTE 'ALTER TABLE public.cusip_quarter_investor_activity_detail ALTER COLUMN id SET NOT NULL';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE contype = 'p'
        AND conrelid = 'public.cusip_quarter_investor_activity_detail'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE public.cusip_quarter_investor_activity_detail ADD PRIMARY KEY (id)';
    END IF;
  END IF;
END $$;
