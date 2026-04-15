DROP FUNCTION IF EXISTS search_entities(TEXT, INT);

DROP INDEX IF EXISTS idx_entities_search_text_trgm;

ALTER TABLE entities DROP COLUMN IF EXISTS search_text;

DROP EXTENSION IF EXISTS pg_trgm;
