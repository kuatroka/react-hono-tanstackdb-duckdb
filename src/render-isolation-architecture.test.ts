import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("rerender isolation architecture", () => {
  test("global search composes isolated input and results surfaces", () => {
    const globalSearch = readProjectFile("src/components/DuckDBGlobalSearch.tsx");

    expect(globalSearch).toContain("GlobalSearchInput");
    expect(globalSearch).toContain("GlobalSearchResults");
  });

  test("asset detail page delegates heavy reactive surfaces to section components", () => {
    const assetDetail = readProjectFile("src/pages/AssetDetail.tsx");

    expect(assetDetail).toContain("AssetActivitySection");
    expect(assetDetail).toContain("AssetFlowSection");
    expect(assetDetail).toContain("AssetDrilldownSection");
    expect(assetDetail).not.toContain("useLiveQuery");
    expect(assetDetail).not.toContain("latencyBadge={");
  });

  test("superinvestor detail page delegates chart ownership to a dedicated section", () => {
    const superinvestorDetail = readProjectFile("src/pages/SuperinvestorDetail.tsx");

    expect(superinvestorDetail).toContain("SuperinvestorChartSection");
    expect(superinvestorDetail).not.toContain("useLiveQuery");
    expect(superinvestorDetail).not.toContain("latencyBadge={");
  });

  test("asset detail drilldown table replaces hover-driven state with a fixed details column", () => {
    const assetDrilldown = readProjectFile("src/components/detail/AssetDrilldownSection.tsx");

    expect(assetDrilldown).toContain("AssetDrilldownDetailsPanel");
    expect(assetDrilldown).toContain("grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]");
    expect(assetDrilldown).not.toContain("useSyncExternalStore");
    expect(assetDrilldown).not.toContain("setHoverSelection");
    expect(assetDrilldown).not.toContain("Hover Interaction");
  });

  test("superinvestor chart hover tooltip avoids React state updates", () => {
    const cikValueLineChart = readProjectFile("src/components/charts/CikValueLineChart.tsx");

    expect(cikValueLineChart).not.toContain("const [tooltip, setTooltip] = useState");
    expect(cikValueLineChart).toContain("tooltip: {");
  });

  test("eCharts activity charts resize without making resize state part of the render path", () => {
    const openedClosedBarChart = readProjectFile("src/components/charts/OpenedClosedBarChart.tsx");
    const investorFlowChart = readProjectFile("src/components/charts/InvestorFlowChart.tsx");

    expect(openedClosedBarChart).toContain("ResizeObserver");
    expect(openedClosedBarChart).toContain("chartRef.current.resize");
    expect(openedClosedBarChart).toContain('chart.on("finished", handleChartFinished)');
    expect(openedClosedBarChart).toContain('chart.off("finished", handleChartFinished)');
    expect(openedClosedBarChart).not.toContain("setChartSize");
    expect(openedClosedBarChart).not.toContain("chartSize");
    expect(openedClosedBarChart).not.toContain("setChartSize(");

    expect(investorFlowChart).toContain("ResizeObserver");
    expect(investorFlowChart).toContain("chartRef.current.resize");
    expect(investorFlowChart).not.toContain("setChartSize");
    expect(investorFlowChart).not.toContain("chartSize");
    expect(investorFlowChart).not.toContain("setChartSize(");
  });

  test("table pages surface separate table and search telemetry badges instead of hardcoded latency placeholders", () => {
    const assetsTable = readProjectFile("src/pages/AssetsTable.tsx");
    const superinvestorsTable = readProjectFile("src/pages/SuperinvestorsTable.tsx");
    const drilldownTable = readProjectFile("src/components/InvestorActivityDrilldownTable.tsx");
    const virtualTable = readProjectFile("src/components/VirtualDataTable.tsx");

    expect(assetsTable).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(assetsTable).toContain("useInfiniteQuery");
    expect(assetsTable).toContain("onTableTelemetryChange={setTableTelemetry}");
    expect(assetsTable).toContain("onLoadMore={assetsQuery.fetchNextPage}");
    expect(assetsTable).toContain("hasNextPage={assetsQuery.hasNextPage}");
    expect(assetsTable).not.toContain("await assetsCollection.preload()");
    expect(assetsTable).not.toContain("latencyMs={isLoading ? undefined : 0}");

    expect(superinvestorsTable).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(superinvestorsTable).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(superinvestorsTable).toContain("onTableTelemetryChange={setTableTelemetry}");
    expect(superinvestorsTable).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
    expect(superinvestorsTable).not.toContain("latencyMs={isLoading ? undefined : 0}");

    expect(drilldownTable).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(drilldownTable).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(drilldownTable).not.toContain('data-testid="drilldown-search-telemetry-slot"');
    expect(drilldownTable).toContain('from "@/components/VirtualDataTable"');
    expect(drilldownTable).toContain("<VirtualDataTable");
    expect(drilldownTable).not.toContain('from "@/components/DataTable"');
    expect(drilldownTable).not.toContain("CardDescription");
    expect(drilldownTable).not.toContain("Loaded from IndexedDB");
    expect(drilldownTable).not.toContain("Served from in-memory cache");
    expect(drilldownTable).not.toContain("Fetched from API (DuckDB)");

    expect(virtualTable).toContain("onTableTelemetryChange");
    expect(virtualTable).toContain("onSearchTelemetryChange");
    expect(virtualTable).toContain('justify-between gap-4 border-b border-border bg-background px-4 py-2');
    expect(virtualTable).toContain('flex min-w-0 flex-1 items-center justify-start gap-2');
    expect(virtualTable).toContain('searchTelemetry={searchTelemetry}');
  });

  test("chart and drilldown surfaces omit subtitle copy after the cleanup commit", () => {
    const assetDrilldown = readProjectFile("src/components/detail/AssetDrilldownSection.tsx");
    const drilldownTable = readProjectFile("src/components/InvestorActivityDrilldownTable.tsx");
    const cikValueChart = readProjectFile("src/components/charts/CikValueLineChart.tsx");
    const investorFlowChart = readProjectFile("src/components/charts/InvestorFlowChart.tsx");
    const openedClosedChart = readProjectFile("src/components/charts/OpenedClosedBarChart.tsx");

    expect(assetDrilldown).not.toContain("All drill-down data loaded - clicks are now instant!");
    expect(drilldownTable).not.toContain("CardDescription");
    expect(cikValueChart).not.toContain("CardDescription");
    expect(investorFlowChart).not.toContain("CardDescription");
    expect(openedClosedChart).not.toContain("CardDescription");
  });

  test("card primitive pins border color to the shared border token so page shells stay visually consistent", () => {
    const cardPrimitive = readProjectFile("src/components/ui/card.tsx");

    expect(cardPrimitive).toContain("border-border");
  });

  test("react-scan is loaded only in development code paths", () => {
    const mainEntrypoint = readProjectFile("src/main.tsx");
    const htmlShell = readProjectFile("index.html");

    expect(mainEntrypoint).toContain('import { scan } from "react-scan"');
    expect(mainEntrypoint).toContain("import.meta.env?.DEV");
    expect(mainEntrypoint).toContain("scan({ enabled: true })");
    expect(htmlShell).not.toContain("react-scan");
  });
});
