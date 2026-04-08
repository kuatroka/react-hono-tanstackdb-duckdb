import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("postgres bootstrap contract", () => {
  test("replays the drizzle bootstrap migrations needed by the current schema", () => {
    const compose = readProjectFile("docker/docker-compose.yml");

    expect(compose).toContain("./migrations/0000_melted_vivisector.sql:/docker-entrypoint-initdb.d/11-migration-drizzle-bootstrap.sql:ro");
    expect(compose).toContain("./migrations/0001_large_selene.sql:/docker-entrypoint-initdb.d/12-migration-drizzle-activity-pk.sql:ro");
    expect(compose).toContain("./migrations/0002_oval_black_tom.sql:/docker-entrypoint-initdb.d/13-migration-drizzle-cusip-columns.sql:ro");
    expect(compose).toContain("./migrations/08_add_performance_indexes.sql:/docker-entrypoint-initdb.d/14-migration-performance-indexes.sql:ro");
  });

  test("quotes the reserved user table when creating performance indexes", () => {
    const performanceIndexes = readProjectFile("docker/migrations/08_add_performance_indexes.sql");

    expect(performanceIndexes).toContain('CREATE INDEX IF NOT EXISTS idx_user_name ON "user"(name, id);');
    expect(performanceIndexes).not.toContain("CREATE INDEX IF NOT EXISTS idx_user_name ON user(name, id);");
  });
});
