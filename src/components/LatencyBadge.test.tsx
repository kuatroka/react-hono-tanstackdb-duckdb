import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LatencyBadge } from "./LatencyBadge";

describe("LatencyBadge", () => {
  test("renders telemetry primary and secondary lines using the shared compact badge treatment", () => {
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
    expect(html).toContain("variant=\"secondary\"");
  });

  test("highlights only the render text in amber without changing the badge background", () => {
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
  });
});
