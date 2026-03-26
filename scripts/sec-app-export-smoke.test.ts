import { describe, expect, test } from "bun:test";
import { buildSecAppExportCommand } from "./sec-app-export-smoke-lib";

describe("buildSecAppExportCommand", () => {
  test("uses the patched sec_app worktree with uv run", () => {
    const command = buildSecAppExportCommand();

    expect(command).toContain("/Users/yo_macbook/Documents/dev/sec_app/.worktrees/pg-catalog-fix");
    expect(command).toContain("uv run python - <<'PY'");
    expect(command).toContain("export_duckdb_tables_to_postgres");
  });
});
