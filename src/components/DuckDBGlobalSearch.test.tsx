import { describe, expect, test } from "bun:test";

describe("DuckDBGlobalSearch", () => {
  test("avoids live query usage on initial mount", async () => {
    const source = await Bun.file(new URL("./DuckDBGlobalSearch.tsx", import.meta.url)).text();

    expect(source).not.toContain("useLiveQuery");
    expect(source).toContain("const loadSearchIndex = useCallback(async () => {");
    expect(source).toContain("if (shouldSearch && !indexLoadStartedRef.current)");
    expect(source).not.toContain("onFocus={handleFocus}");
  });
});
