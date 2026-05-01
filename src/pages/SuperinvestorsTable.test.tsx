import { describe, expect, test } from "bun:test";

describe("SuperinvestorsTablePage", () => {
  test("uses collection preload instead of a live query on initial mount", async () => {
    const source = await Bun.file(new URL("./SuperinvestorsTable.tsx", import.meta.url)).text();

    expect(source).not.toContain("useLiveQuery");
    expect(source).toContain("await superinvestorsCollection.preload()");
    expect(source).toContain("await superinvestorsCollection.utils.refetch()");
    expect(source).toContain("useState<Superinvestor[]>(() => getLoadedSuperinvestorList())");
    expect(source).toContain("if (rows.length > 0)");
    expect(source).toContain('setDataSource("tsdb-memory")');
    expect(source).toContain("getLoadedSuperinvestorList()");
    expect(source).not.toContain("clearSuperinvestorListSessionState");
    expect(source).toContain("useMarkContentReady");
    expect(source).toContain("clientPageSize={100}");
    expect(source).toContain('searchStrategy="ufuzzy"');
    expect(source).toContain('mode: "name-only"');
    expect(source).toContain("getName: (row: Superinvestor) => row.cikName");
    expect(source).not.toContain("onReady={onReady}");
    expect(source).not.toContain("useSearch");
    expect(source).not.toContain("useNavigate");
  });

  test("keeps search telemetry inside the table header instead of duplicating it in the page chrome", async () => {
    const source = await Bun.file(new URL("./SuperinvestorsTable.tsx", import.meta.url)).text();

    expect(source).toContain("createPerfTelemetryStore()");
    expect(source).toContain("PerfTelemetryBadgeSlot");
    expect(source).toContain("onTableTelemetryChange={tableTelemetryStore.set}");
    expect(source).not.toContain("const [tableTelemetry, setTableTelemetry]");
    expect(source).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(source).not.toContain("telemetry={searchTelemetry}");
    expect(source).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
  });

  test("disables route preloading for dense superinvestor table links", async () => {
    const source = await Bun.file(new URL("./SuperinvestorsTable.tsx", import.meta.url)).text();

    expect(source).toContain('to="/superinvestors/$cik"');
    expect(source).toContain("preload={false}");
  });
});
