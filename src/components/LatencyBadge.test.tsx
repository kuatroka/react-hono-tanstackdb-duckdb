import { describe, expect, test } from "bun:test";

describe("LatencyBadge", () => {
  test("keeps telemetry badges on the shared compact secondary badge treatment", async () => {
    const source = await Bun.file(new URL("./LatencyBadge.tsx", import.meta.url)).text();

    expect(source).toContain('variant="secondary"');
    expect(source).toContain("<span>{primaryLine}</span>");
    expect(source).toContain("{secondaryLine ? <span>{secondaryLine}</span> : null}");
  });

  test("keeps inline render latency highlighted in amber on a transparent badge", async () => {
    const source = await Bun.file(new URL("./LatencyBadge.tsx", import.meta.url)).text();

    expect(source).toContain('data-latency-part="render"');
    expect(source).toContain('className="inline-flex items-center gap-1 text-[goldenrod]"');
    expect(source).toContain('variant="outline"');
    expect(source).toContain('"text-[10px] px-1.5 py-0.5 font-medium border bg-transparent inline-flex items-center gap-1"');
  });
});
