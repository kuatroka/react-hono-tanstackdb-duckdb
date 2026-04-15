# PostgreSQL 18 with pg_mooncake and pg_duckdb

Official Mooncake Labs image with PostgreSQL 18, pg_mooncake, and pg_duckdb.

## Quick Start

```bash
bun run dev:db-up    # Start (auto-initializes on first run)
bun run dev:db-down  # Stop
bun run dev:clean && bun run dev:db-up  # Clean restart
```

## Connection

- Host: localhost:5432
- User: `user` / Password: `password`
- Database: `postgres`

## Initialization

On first startup, the database automatically:
1. Enables pg_mooncake and pg_duckdb extensions
2. Creates base tables (user, medium, message)
3. Creates counters and value_quarters tables with data
4. Creates entities table with 1000 records (500 investors + 500 assets)
5. Configures DuckDB settings

All initialization scripts are idempotent and safe to run multiple times.

## Usage

```sql
-- Query Parquet files
SELECT * FROM read_parquet('/path/to/file.parquet') LIMIT 10;

-- Create columnstore mirror
CALL mooncake.create_table('trades_mirror', 'trades');
SELECT * FROM trades_mirror WHERE symbol = 'AAPL';
```
