-- Add indexes to improve Zero sync performance
-- These indexes match the ORDER BY clauses in Zero queries to avoid full table scans

-- Assets table: ordered by asset_name, id
CREATE INDEX IF NOT EXISTS idx_assets_asset_name ON assets(asset_name, id);

-- Superinvestors table: ordered by cik_name, id (40,000+ rows!)
CREATE INDEX IF NOT EXISTS idx_superinvestors_cik_name ON superinvestors(cik_name, id);

-- Searches table: filtered by code
CREATE INDEX IF NOT EXISTS idx_searches_code ON searches(code);

-- User_counters table: filtered by user_id
CREATE INDEX IF NOT EXISTS idx_user_counters_user_id ON user_counters(user_id);

-- Message table: ordered by timestamp desc, id
CREATE INDEX IF NOT EXISTS idx_message_timestamp ON message(timestamp DESC, id);

-- Medium table: ordered by name, id
CREATE INDEX IF NOT EXISTS idx_medium_name ON medium(name, id);

-- User table: ordered by name, id
CREATE INDEX IF NOT EXISTS idx_user_name ON "user"(name, id);

-- Value_quarters table: ordered by quarter
CREATE INDEX IF NOT EXISTS idx_value_quarters_quarter ON value_quarters(quarter);

-- Counters table: filtered by id
CREATE INDEX IF NOT EXISTS idx_counters_id ON counters(id);
