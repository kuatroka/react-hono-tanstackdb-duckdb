import { describe, expect, test } from "bun:test";

describe("SuperinvestorsTablePage", () => {
  test("uses collection preload instead of a live query on initial mount", async () => {
    const source = await Bun.file(new URL("./SuperinvestorsTable.tsx", import.meta.url)).text();

    expect(source).not.toContain("useLiveQuery");
    expect(source).toContain("await superinvestorsCollection.preload()");
    expect(source).toContain("Array.from(superinvestorsCollection.entries())");
    expect(source).toContain("useMarkContentReady");
    expect(source).toContain("clientPageSize={100}");
    expect(source).not.toContain("onReady={onReady}");
    expect(source).not.toContain("useSearch");
    expect(source).not.toContain("useNavigate");
  });

  test("keeps search telemetry inside the table header instead of duplicating it in the page chrome", async () => {
    const source = await Bun.file(new URL("./SuperinvestorsTable.tsx", import.meta.url)).text();

    expect(source).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(source).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(source).not.toContain("telemetry={searchTelemetry}");
    expect(source).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
  });
});
