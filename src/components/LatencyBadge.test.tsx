import { describe, expect, test } from "bun:test";

describe("LatencyBadge", () => {
  test("renders telemetry badges with the shared outline treatment and split source coloring", async () => {
    const source = await Bun.file(new URL("./LatencyBadge.tsx", import.meta.url)).text();

    expect(source).toContain('variant="outline"');
    expect(source).toContain('bg-transparent inline-flex items-center gap-1');
    expect(source).toContain('text-teal-600 dark:text-teal-400');
    expect(source).toContain('text-[goldenrod]');
    expect(source).toContain('{secondaryLine ? (');
  });

  test("labels inline hydration latency by source and keeps render highlighted in amber", async () => {
    const source = await Bun.file(new URL("./LatencyBadge.tsx", import.meta.url)).text();

    expect(source).toContain('const hydrationSourceLabel = formatPerfSourceLabel(resolvedSource);');
    expect(source).toContain('data-latency-part="render"');
    expect(source).toContain('className="inline-flex items-center gap-1 text-[goldenrod]"');
    expect(source).toContain('{hydrationSourceLabel}:');
  });

  test("uses the source label as the default single-badge caption", async () => {
    const source = await Bun.file(new URL("./LatencyBadge.tsx", import.meta.url)).text();

    expect(source).toContain('const sourceLabel = label ?? formatPerfSourceLabel(resolvedSource);');
    expect(source).toContain('{sourceLabel}:');
    expect(source).not.toContain('createLegacyPerfTelemetry');
  });
});
