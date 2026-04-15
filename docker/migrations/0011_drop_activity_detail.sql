-- Drop the cusip_quarter_investor_activity_detail table
-- This data is now served via pg_duckdb from Parquet files (see api/routes/drilldown.ts)
-- The table was consuming ~8.7GB in Postgres and causing disk space issues

DROP TABLE IF EXISTS cusip_quarter_investor_activity_detail;
