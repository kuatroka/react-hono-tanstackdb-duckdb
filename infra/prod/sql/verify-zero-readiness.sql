DO $$
BEGIN
  IF current_setting('wal_level') <> 'logical' THEN
    RAISE EXCEPTION 'wal_level must be logical for Zero, got %', current_setting('wal_level');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_duckdb') THEN
    RAISE EXCEPTION 'pg_duckdb extension is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_mooncake') THEN
    RAISE EXCEPTION 'pg_mooncake extension is missing';
  END IF;

  IF to_regclass('public.user') IS NULL THEN
    RAISE EXCEPTION 'public.user is missing';
  END IF;

  IF to_regclass('public.medium') IS NULL THEN
    RAISE EXCEPTION 'public.medium is missing';
  END IF;

  IF to_regclass('public.message') IS NULL THEN
    RAISE EXCEPTION 'public.message is missing';
  END IF;

  IF to_regclass('serving.assets') IS NULL THEN
    RAISE EXCEPTION 'serving.assets is missing';
  END IF;

  IF to_regclass('serving.superinvestors') IS NULL THEN
    RAISE EXCEPTION 'serving.superinvestors is missing';
  END IF;

  IF to_regclass('serving.cusip_quarter_investor_activity') IS NULL THEN
    RAISE EXCEPTION 'serving.cusip_quarter_investor_activity is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'serving.cusip_quarter_investor_activity'::regclass
  ) THEN
    RAISE EXCEPTION 'serving.cusip_quarter_investor_activity must have a primary key for Zero sync';
  END IF;

  IF to_regclass('serving.cusip_quarter_investor_activity_detail') IS NULL THEN
    RAISE EXCEPTION 'serving.cusip_quarter_investor_activity_detail is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'serving.cusip_quarter_investor_activity_detail'::regclass
  ) THEN
    RAISE EXCEPTION 'serving.cusip_quarter_investor_activity_detail must have a primary key for Zero sync';
  END IF;

  IF to_regclass('app_state.user_counters') IS NULL THEN
    RAISE EXCEPTION 'app_state.user_counters is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zapp_app') THEN
    RAISE EXCEPTION 'publication zapp_app is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'zapp_app'
      AND schemaname = 'serving'
      AND tablename = 'assets'
  ) THEN
    RAISE EXCEPTION 'publication zapp_app is missing serving.assets';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'zapp_app'
      AND schemaname = 'serving'
      AND tablename = 'cusip_quarter_investor_activity'
  ) THEN
    RAISE EXCEPTION 'publication zapp_app is missing serving.cusip_quarter_investor_activity';
  END IF;
END $$;

SELECT current_setting('wal_level') AS wal_level;
SELECT extname
FROM pg_extension
WHERE extname IN ('pg_duckdb', 'pg_mooncake')
ORDER BY extname;

SELECT pubname
FROM pg_publication
WHERE pubname = 'zapp_app';
