import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LatencyBadge } from "./LatencyBadge";

describe("LatencyBadge", () => {
  test("renders telemetry in the compact outline badge treatment", () => {
    const html = renderToStaticMarkup(
      <LatencyBadge
        telemetry={{
          source: "zero-client",
          label: "investorActivity: data",
          ms: 3.5,
          primaryLine: "zero-client investorActivity: data: 3.50ms",
          secondaryLine: "render: 1.20ms",
        }}
      />,
    );

    expect(html).toContain("zero-client investorActivity: data: 3.50ms");
    expect(html).toContain("render: 1.20ms");
    expect(html).toContain('variant="outline"');
    expect(html).toContain("text-teal-600");
    expect(html).toContain("text-[goldenrod]");
    expect(html).not.toContain("zero-client investorActivity: uPlot render: 1.20ms");
  });

  test("uses the hydration source label instead of generic data text in inline mode", () => {
    const html = renderToStaticMarkup(
      <LatencyBadge
        dataLoadMs={4}
        renderMs={12}
        source="tsdb-indexeddb"
        variant="inline"
      />,
    );

    expect(html).toContain("TanStack DB (IndexedDB):");
    expect(html).toContain("4.0ms");
    expect(html).toContain("render:");
    expect(html).toContain("12ms");
    expect(html).toContain("TanStack DB (IndexedDB)");
    expect(html).toContain('data-latency-part="render"');
    expect(html).toContain("text-teal-600");
    expect(html).toContain("text-[goldenrod]");
    expect(html).toContain("bg-transparent");
    expect(html).not.toContain(">data:<");
    expect(html).not.toContain("TanStack DB (IndexedDB) | TanStack DB (IndexedDB)");
  });

  test("uses the hydration source label for single latency badges too", () => {
    const html = renderToStaticMarkup(
      <LatencyBadge latencyMs={27} source="api-duckdb" />,
    );

    expect(html).toContain("API (DuckDB):");
    expect(html).toContain("27ms");
    expect(html).not.toContain(">data:<");
  });
});