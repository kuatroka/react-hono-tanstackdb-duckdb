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

  test("asset drilldown hover interaction is isolated from provider-level React state", () => {
    const assetDrilldown = readProjectFile("src/components/detail/AssetDrilldownSection.tsx");

    expect(assetDrilldown).toContain("useSyncExternalStore");
    expect(assetDrilldown).not.toContain("const [hoverSelection, setHoverSelectionState] = useState");
  });

  test("superinvestor chart hover tooltip avoids React state updates", () => {
    const cikValueLineChart = readProjectFile("src/components/charts/CikValueLineChart.tsx");

    expect(cikValueLineChart).not.toContain("const [tooltip, setTooltip] = useState");
    expect(cikValueLineChart).toContain("tooltipRef");
  });
});
