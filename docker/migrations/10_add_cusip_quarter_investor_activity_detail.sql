CREATE TABLE IF NOT EXISTS cusip_quarter_investor_activity_detail (
  id       BIGINT,
  cusip    VARCHAR,
  ticker   VARCHAR,
  quarter  VARCHAR,
  cik      BIGINT,
  did_open BOOLEAN,
  did_add BOOLEAN,
  did_reduce BOOLEAN,
  did_close BOOLEAN,
  did_hold BOOLEAN
);

ALTER TABLE cusip_quarter_investor_activity_detail ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'public.cusip_quarter_investor_activity_detail'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE cusip_quarter_investor_activity_detail ADD PRIMARY KEY (id)';
  END IF;
END $$;
