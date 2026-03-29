import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LatencyBadge } from "./LatencyBadge";

describe("LatencyBadge", () => {
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
