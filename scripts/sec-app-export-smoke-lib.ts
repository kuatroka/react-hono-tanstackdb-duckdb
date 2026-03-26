const SEC_APP_WORKTREE = "/Users/yo_macbook/Documents/dev/sec_app/.worktrees/pg-catalog-fix";

export function buildSecAppExportCommand() {
  return `cd ${SEC_APP_WORKTREE} && uv run python - <<'PY'
from pathlib import Path
import json
import os
from sec_app.pipeline.db_creation_utils import export_duckdb_tables_to_postgres

manifest = json.loads(Path('/Users/yo_macbook/Documents/app_data/TR_05_DB/db_manifest.json').read_text())
duckdb_path = Path('/Users/yo_macbook/Documents/app_data/TR_05_DB') / f"TR_05_DUCKDB_FILE_{manifest['active']}.duckdb"

os.environ.setdefault('POSTGRES_HOST', '127.0.0.1')
os.environ.setdefault('POSTGRES_PORT', '5432')
os.environ.setdefault('POSTGRES_USER', 'user')
os.environ.setdefault('POSTGRES_PASSWORD', 'password')
os.environ.setdefault('POSTGRES_DB', 'postgres')

result = export_duckdb_tables_to_postgres(
    duckdb_path=str(duckdb_path),
    tables=[
        'searches',
        'superinvestors',
        'assets',
        'cusip_quarter_investor_activity',
        'cusip_quarter_investor_activity_detail',
    ],
    verify_only=False,
)
print(result)
PY`;
}
