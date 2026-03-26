CREATE SCHEMA IF NOT EXISTS "serving";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "app_state";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "raw";
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('serving.counters') IS NULL AND to_regclass('public.counters') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.counters SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.value_quarters') IS NULL AND to_regclass('public.value_quarters') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.value_quarters SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.entities') IS NULL AND to_regclass('public.entities') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.entities SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.searches') IS NULL AND to_regclass('public.searches') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.searches SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.superinvestors') IS NULL AND to_regclass('public.superinvestors') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.superinvestors SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.assets') IS NULL AND to_regclass('public.assets') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.assets SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.periods') IS NULL AND to_regclass('public.periods') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.periods SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.cusip_quarter_investor_activity') IS NULL
    AND to_regclass('public.cusip_quarter_investor_activity') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.cusip_quarter_investor_activity SET SCHEMA serving';
  END IF;

  IF to_regclass('serving.cusip_quarter_investor_activity_detail') IS NULL
    AND to_regclass('public.cusip_quarter_investor_activity_detail') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.cusip_quarter_investor_activity_detail SET SCHEMA serving';
  END IF;

  IF to_regclass('app_state.user_counters') IS NULL AND to_regclass('public.user_counters') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_counters SET SCHEMA app_state';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "serving"."cusip_quarter_investor_activity_detail" (
  "id" bigint PRIMARY KEY NOT NULL,
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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA serving TO app_reader';
    EXECUTE 'GRANT USAGE ON SCHEMA app_state TO app_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA serving TO app_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA serving GRANT SELECT ON TABLES TO app_reader';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pipeline_writer') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA raw TO pipeline_writer';
    EXECUTE 'GRANT USAGE ON SCHEMA serving TO pipeline_writer';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA serving TO pipeline_writer';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA serving GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pipeline_writer';
  END IF;
END $$;
