-- Create searches table to match DuckDB pipeline schema
-- Data will be populated by the DuckDB pipeline via Postgres extension
-- This table is read-only from the web app perspective

CREATE TABLE IF NOT EXISTS searches (
  id       BIGINT PRIMARY KEY,
  code     TEXT NOT NULL,
  name     TEXT,
  category TEXT NOT NULL CHECK (category IN ('superinvestors', 'assets', 'periods'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_searches_category ON searches(category);
CREATE INDEX IF NOT EXISTS idx_searches_name ON searches(name);
CREATE INDEX IF NOT EXISTS idx_searches_code ON searches(code);

-- Grant read permissions
GRANT SELECT ON searches TO PUBLIC;
