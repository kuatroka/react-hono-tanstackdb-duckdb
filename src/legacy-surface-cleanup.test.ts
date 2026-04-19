import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function projectPath(relativePath: string) {
  return join(projectRoot, relativePath);
}

describe("legacy analytics surface cleanup", () => {
  test("removes orphaned database scaffolding files", () => {
    const removedPaths = [
      ".zero-data",
      "api/db.ts",
      "api/bun-native-benchmark.ts",
      "drizzle.config.ts",
      "sst.config.ts",
      "sst-env.d.ts",
      "src/db/schema.ts",
      "src/postgres-bootstrap-contract.test.ts",
      "scripts/detect-container-runtime.sh",
      "scripts/benchmark-drivers.ts",
      "scripts/check-db.ts",
      "scripts/check-db-2.ts",
      "scripts/check-exports.ts",
      "scripts/check-process-queries.ts",
      "scripts/check-transaction.ts",
      "scripts/check-zql.ts",
      "scripts/test-drilldown.sh",
    ];

    for (const relativePath of removedPaths) {
      expect(existsSync(projectPath(relativePath))).toBe(false);
    }
  });
});
