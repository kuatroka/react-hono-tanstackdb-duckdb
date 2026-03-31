import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("serving Zero-sync schema contract", () => {
  test("bootstrap migration repairs both investor activity tables", () => {
    const migration = readProjectFile("docker/migrations/0010_enable_investor_activity_zero_sync.sql");

    expect(migration).toContain("serving.cusip_quarter_investor_activity");
    expect(migration).toContain("serving.cusip_quarter_investor_activity_detail");
    expect(migration).toContain(
      "Cannot enable Zero sync for serving.cusip_quarter_investor_activity_detail: id contains NULL values"
    );
    expect(migration).toContain(
      "ALTER TABLE serving.cusip_quarter_investor_activity_detail ALTER COLUMN id SET NOT NULL"
    );
    expect(migration).toContain(
      "ALTER TABLE serving.cusip_quarter_investor_activity_detail ADD PRIMARY KEY (id)"
    );
  });

  test("readiness check enforces the detail-table primary key contract", () => {
    const readiness = readProjectFile("infra/prod/sql/verify-zero-readiness.sql");

    expect(readiness).toContain("serving.cusip_quarter_investor_activity_detail is missing");
    expect(readiness).toContain(
      "serving.cusip_quarter_investor_activity_detail must have a primary key for Zero sync"
    );
  });
});
