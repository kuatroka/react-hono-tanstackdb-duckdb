import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LatencyBadge } from "./LatencyBadge";

describe("LatencyBadge", () => {
  test("renders compact telemetry with the traced human-readable source labels instead of Zero terminology", () => {
    const html = renderToStaticMarkup(
      <LatencyBadge
        telemetry={{
          source: "tsdb-memory",
          label: "investorActivity: data",
          ms: 3.5,
          primaryLine: "TanStack DB (memory) investorActivity: data: 3.50ms",
          secondaryLine: "TanStack DB (memory) investorActivity: uPlot render: 1.20ms",
        }}
      />,
    );

    expect(html).toContain("TanStack DB (memory) investorActivity: data: 3.50ms");
    expect(html).toContain("TanStack DB (memory) investorActivity: uPlot render: 1.20ms");
    expect(html).not.toContain("zero-client");
    expect(html).toContain("variant=\"secondary\"");
    expect(html).toContain('data-testid="latency-badge"');
    expect(html).toContain('data-latency-mode="telemetry"');
  });

  test("keeps the three-section inline contract with render isolated from the origin label", () => {
    const html = renderToStaticMarkup(
      <LatencyBadge
        dataLoadMs={4}
        renderMs={12}
        source="tsdb-indexeddb"
        variant="inline"
      />,
    );

    expect(html).toContain('data-latency-part="render"');
    expect(html).toContain("text-[goldenrod]");
    expect(html).toContain("bg-transparent");
    expect(html).toContain("data:");
    expect(html).toContain("render:");
    expect(html).toContain("TanStack DB (IndexedDB)");
    expect(html).toContain('data-latency-mode="inline"');
    expect(html).toContain('data-latency-data-ms="4"');
    expect(html).toContain('data-latency-render-ms="12"');
  });

  test("renders API badges with the exact traced backend database name", () => {
    const html = renderToStaticMarkup(
      <LatencyBadge latencyMs={157} source="tsdb-api" />,
    );

    expect(html).toContain("API (DuckDB) data: 157ms");
    expect(html).not.toContain("api:pg");
    expect(html).not.toContain("tsdb-api data");
  });
});
