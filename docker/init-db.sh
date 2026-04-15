#!/bin/bash
set -e

echo "🔍 Checking database state..."

# Function to check if a table exists and has data
check_table() {
    local table_name=$1
    local has_table=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name');")
    
    if [ "$has_table" = "t" ]; then
        local row_count=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM \"$table_name\";")
        echo "  ✓ Table '$table_name' exists with $row_count rows"
        echo "$row_count"
    else
        echo "  ✗ Table '$table_name' does not exist"
        echo "0"
    fi
}

# Check critical tables from seed.sql
user_count=$(check_table "user")
medium_count=$(check_table "medium")
message_count=$(check_table "message")

# Run seed if needed
if [ "$user_count" = "0" ] || [ "$medium_count" = "0" ]; then
    echo "📦 Seed tables are missing or empty - running seed.sql"
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/seed.sql
    echo "✅ Seed completed"
else
    echo "✅ Seed tables already populated - skipping seed.sql"
fi

# Run each migration individually if its tables don't exist
echo "🔄 Checking migrations..."

# Migration 02: counters and value_quarters
counters_count=$(check_table "counters")
value_quarters_count=$(check_table "value_quarters")
if [ "$counters_count" = "0" ] || [ "$value_quarters_count" = "0" ]; then
    echo "  → Running 02_add_counter_quarters.sql..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/migrations/02_add_counter_quarters.sql
    echo "  ✅ Migration 02 completed"
else
    echo "  ✅ Migration 02 already applied - skipping"
fi

# Migration 03: entities
entities_count=$(check_table "entities")
if [ "$entities_count" = "0" ]; then
    echo "  → Running 03_add_entities.sql..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/migrations/03_add_entities.sql
    echo "  ✅ Migration 03 completed"
else
    echo "  ✅ Migration 03 already applied - skipping"
fi

# Migration 04: rollback (always run if file exists, it's idempotent)
if [ -f /docker-entrypoint-initdb.d/migrations/04_rollback_full_text_search.sql ]; then
    echo "  → Running 04_rollback_full_text_search.sql..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/migrations/04_rollback_full_text_search.sql 2>/dev/null || true
    echo "  ✅ Migration 04 completed"
fi

echo "🎉 Database initialization check complete!"
