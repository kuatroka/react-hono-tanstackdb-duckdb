CREATE TABLE IF NOT EXISTS counters (
  id TEXT PRIMARY KEY,
  value DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS value_quarters (
  quarter TEXT PRIMARY KEY,
  value DOUBLE PRECISION NOT NULL
);

INSERT INTO counters (id, value)
VALUES ('main', 0)
ON CONFLICT (id) DO NOTHING;

SELECT setseed(0.42);

WITH years AS (
  SELECT generate_series(1999, 2025) AS y
), quarters AS (
  SELECT unnest(ARRAY[1,2,3,4]) AS q
), ranges AS (
  SELECT y, q
  FROM years CROSS JOIN quarters
  WHERE (y > 1999 OR q >= 1)
    AND (y < 2025 OR q <= 4)
), to_insert AS (
  SELECT
    (y::text || 'Q' || q::text) AS quarter,
    (random() * (500000000000.0 - 1.0) + 1.0) AS value
  FROM ranges
)
INSERT INTO value_quarters (quarter, value)
SELECT quarter, value FROM to_insert
ON CONFLICT (quarter) DO NOTHING;
