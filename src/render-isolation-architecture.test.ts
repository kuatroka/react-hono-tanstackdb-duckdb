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

  test("asset drilldown section keeps its selection state local and avoids hoisting it into the page", () => {
    const assetDrilldown = readProjectFile("src/components/detail/AssetDrilldownSection.tsx");

    expect(assetDrilldown).toContain("AssetDrilldownSectionContext");
    expect(assetDrilldown).toContain("const [selection, setSelection] = useState");
    expect(assetDrilldown).toContain("setSelection: handleSelectionChange");
  });

  test("superinvestor chart hover tooltip avoids React state updates", () => {
    const cikValueLineChart = readProjectFile("src/components/charts/CikValueLineChart.tsx");

    expect(cikValueLineChart).not.toContain("const [tooltip, setTooltip] = useState");
    expect(cikValueLineChart).toContain("tooltipRef");
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

  test("table pages keep only table telemetry in the card header while the search badge lives in the table header", () => {
    const assetsTable = readProjectFile("src/pages/AssetsTable.tsx");
    const superinvestorsTable = readProjectFile("src/pages/SuperinvestorsTable.tsx");
    const virtualTable = readProjectFile("src/components/VirtualDataTable.tsx");

    expect(assetsTable).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(assetsTable).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(assetsTable).toContain("onTableTelemetryChange={setTableTelemetry}");
    expect(assetsTable).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
    expect(assetsTable).not.toContain("searchTelemetryLabel=\"search\"");

    expect(superinvestorsTable).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(superinvestorsTable).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(superinvestorsTable).toContain("onTableTelemetryChange={setTableTelemetry}");
    expect(superinvestorsTable).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
    expect(superinvestorsTable).not.toContain("searchTelemetryLabel=\"search\"");

    expect(virtualTable).toContain("HeaderTelemetrySlot");
    expect(virtualTable).not.toContain("searchTelemetryLabel");
  });

  test("card primitive pins border color to the shared border token so page shells match the Zero app", () => {
    const cardPrimitive = readProjectFile("src/components/ui/card.tsx");

    expect(cardPrimitive).toContain("border-border");
  });

  test("react-scan is loaded only in development or local-browser code paths", () => {
    const mainEntrypoint = readProjectFile("src/main.tsx");
    const htmlShell = readProjectFile("index.html");

    expect(mainEntrypoint).toContain("react-scan/dist/auto.global.js");
    expect(mainEntrypoint).toContain("window.location.hostname");
    expect(mainEntrypoint).toContain("import.meta.env?.DEV");
    expect(htmlShell).not.toContain("react-scan/dist/auto.global.js");
  });
});
