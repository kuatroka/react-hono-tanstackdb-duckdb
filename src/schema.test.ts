import { describe, expect, test } from "bun:test";
import { schema } from "./schema";

describe("schema", () => {
  test("includes investor activity for Zero sync", () => {
    expect("cusip_quarter_investor_activity" in schema.tables).toBe(true);
  });
});
