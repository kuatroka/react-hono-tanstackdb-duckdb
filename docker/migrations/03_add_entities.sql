CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('investor', 'asset')),
  description TEXT,
  value DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_category ON entities(category);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

SELECT setseed(0.42);

WITH investor_data AS (
  SELECT
    generate_series(1, 500) AS num,
    ARRAY['Technology', 'Healthcare', 'Finance', 'Real Estate', 'Energy', 'Consumer Goods', 'Manufacturing', 'Retail', 'Transportation', 'Telecommunications'] AS sectors
), investor_inserts AS (
  SELECT
    ('Investor ' || num::text) AS name,
    'investor' AS category,
    ('Investment firm focused on ' || sectors[1 + floor(random() * 10)::int] || '. Portfolio includes ' || (5 + floor(random() * 46)::int)::text || ' companies with strong growth potential and market leadership.') AS description,
    (1000000 + random() * 499000000)::DECIMAL(15,2) AS value
  FROM investor_data
), asset_data AS (
  SELECT
    generate_series(1, 500) AS num,
    ARRAY['Commercial', 'Residential', 'Industrial', 'Digital', 'Infrastructure', 'Agricultural', 'Mixed-Use', 'Retail', 'Office', 'Hospitality'] AS types,
    ARRAY['Technology', 'Healthcare', 'Finance', 'Real Estate', 'Energy', 'Consumer Goods', 'Manufacturing', 'Retail', 'Transportation', 'Telecommunications'] AS sectors
), asset_inserts AS (
  SELECT
    ('Asset ' || num::text) AS name,
    'asset' AS category,
    (types[1 + floor(random() * 10)::int] || ' asset in ' || sectors[1 + floor(random() * 10)::int] || ' sector. Established in ' || (1990 + floor(random() * 35)::int)::text || ' with consistent performance and strong fundamentals.') AS description,
    (100000 + random() * 99900000)::DECIMAL(15,2) AS value
  FROM asset_data
)
INSERT INTO entities (name, category, description, value)
SELECT name, category, description, value FROM investor_inserts
UNION ALL
SELECT name, category, description, value FROM asset_inserts
ON CONFLICT (id) DO NOTHING;
