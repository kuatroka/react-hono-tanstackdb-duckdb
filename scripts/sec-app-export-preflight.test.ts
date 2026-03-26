import { describe, expect, test } from "bun:test";
import { buildDuckDbLockMessage } from "./sec-app-export-preflight";

describe("buildDuckDbLockMessage", () => {
  test("surfaces the conflicting process in a human-readable error", () => {
    const message = buildDuckDbLockMessage("/tmp/source.duckdb", [
      "python3 80877 yo_macbook",
      "python3 81234 yo_macbook",
    ]);

    expect(message).toContain("DuckDB source is already open");
    expect(message).toContain("/tmp/source.duckdb");
    expect(message).toContain("80877");
  });
});
