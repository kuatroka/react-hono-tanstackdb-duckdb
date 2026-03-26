CREATE TABLE IF NOT EXISTS cusip_quarter_investor_activity (
    id         BIGINT,
    cusip      VARCHAR,
    ticker     VARCHAR,
    quarter    VARCHAR,
    num_open   BIGINT,
    num_add    BIGINT,
    num_reduce BIGINT,
    num_close  BIGINT,
    num_hold   BIGINT
);

ALTER TABLE cusip_quarter_investor_activity ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'public.cusip_quarter_investor_activity'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE cusip_quarter_investor_activity ADD PRIMARY KEY (id)';
  END IF;
END $$;
