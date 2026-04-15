-- Create superinvestors, assets, and periods tables to match DuckDB pipeline schema
-- Data will be populated by a separate data pipeline
-- These tables are read-only from the web app perspective

-- Superinvestors table: Institutional investors (13F filers)
CREATE TABLE IF NOT EXISTS superinvestors (
  id             BIGINT PRIMARY KEY,
  cik            TEXT NOT NULL,
  cik_name       TEXT,
  cik_ticker     TEXT,
  active_periods TEXT
);

-- Assets table: Securities/assets information
CREATE TABLE IF NOT EXISTS assets (
  id         BIGINT PRIMARY KEY,
  asset      TEXT NOT NULL,
  asset_name TEXT
);

-- Periods table: Reporting periods (quarters)
CREATE TABLE IF NOT EXISTS periods (
  id     BIGINT PRIMARY KEY,
  period TEXT NOT NULL UNIQUE
);

-- Grant read permissions
GRANT SELECT ON superinvestors TO PUBLIC;
GRANT SELECT ON assets TO PUBLIC;
GRANT SELECT ON periods TO PUBLIC;
