-- Function to query investor activity drill-down data from partitioned Parquet files
-- Uses pg_duckdb to read directly from Parquet without importing into Postgres
-- Note: pg_duckdb requires r['column'] syntax for column access

CREATE OR REPLACE FUNCTION get_ticker_activity(
    p_ticker TEXT,
    p_quarter TEXT DEFAULT NULL,
    p_action TEXT DEFAULT NULL
)
RETURNS TABLE (
    cusip TEXT,
    quarter TEXT,
    cik BIGINT,
    did_open BOOLEAN,
    did_add BOOLEAN,
    did_reduce BOOLEAN,
    did_close BOOLEAN,
    did_hold BOOLEAN,
    cusip_ticker TEXT
)
AS $$
DECLARE
    parquet_path TEXT;
    query TEXT;
BEGIN
    -- Build path to the ticker's parquet file
    -- Note: /app_data is the Docker mount point for APP_DATA_PATH
    parquet_path := '/app_data/TR_BY_TICKER_CONSOLIDATED/cusip_ticker=' || p_ticker || '/*.parquet';
    
    -- Build dynamic query with optional filters
    -- pg_duckdb requires r['col'] syntax and 'r' alias
    query := 'SELECT 
        r[''cusip'']::TEXT as cusip,
        r[''quarter'']::TEXT as quarter,
        r[''cik'']::BIGINT as cik,
        r[''did_open'']::BOOLEAN as did_open,
        r[''did_add'']::BOOLEAN as did_add,
        r[''did_reduce'']::BOOLEAN as did_reduce,
        r[''did_close'']::BOOLEAN as did_close,
        r[''did_hold'']::BOOLEAN as did_hold,
        r[''cusip_ticker'']::TEXT as cusip_ticker
    FROM read_parquet(''' || parquet_path || ''') r WHERE 1=1';
    
    -- Add quarter filter if provided
    IF p_quarter IS NOT NULL THEN
        query := query || ' AND r[''quarter''] = ''' || p_quarter || '''';
    END IF;
    
    -- Add action filter if provided
    IF p_action IS NOT NULL THEN
        CASE p_action
            WHEN 'open' THEN query := query || ' AND r[''did_open''] = true';
            WHEN 'add' THEN query := query || ' AND r[''did_add''] = true';
            WHEN 'reduce' THEN query := query || ' AND r[''did_reduce''] = true';
            WHEN 'close' THEN query := query || ' AND r[''did_close''] = true';
            WHEN 'hold' THEN query := query || ' AND r[''did_hold''] = true';
            ELSE NULL; -- ignore invalid action
        END CASE;
    END IF;
    
    RETURN QUERY EXECUTE query;
END;
$$ LANGUAGE plpgsql;
