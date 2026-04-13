import { describe, expect, test } from "bun:test";

describe("SuperinvestorsTablePage", () => {
  test("uses collection preload instead of a live query on initial mount", async () => {
    const source = await Bun.file(new URL("./SuperinvestorsTable.tsx", import.meta.url)).text();

    expect(source).not.toContain("useLiveQuery");
    expect(source).toContain("await superinvestorsCollection.preload()");
    expect(source).toContain("Array.from(superinvestorsCollection.entries())");
  });
});
