import { describe, expect, test } from "bun:test";

describe("DuckDBGlobalSearch", () => {
  test("re-exports the uFuzzy-backed production global search", async () => {
    const source = await Bun.file(new URL("./DuckDBGlobalSearch.tsx", import.meta.url)).text();

    expect(source).toContain('UFuzzyGlobalSearch');
    expect(source).toContain('export { UFuzzyGlobalSearch as DuckDBGlobalSearch }');
  });
});
