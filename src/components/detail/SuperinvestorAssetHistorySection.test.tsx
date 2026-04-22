import { describe, expect, test } from "bun:test";

describe("SuperinvestorAssetHistorySection", () => {
  test("uses the reduced journey summary instead of the old chart header and chips", async () => {
    const source = await Bun.file(new URL("./SuperinvestorAssetHistorySection.tsx", import.meta.url)).text();

    expect(source).toContain("const summaryChips = useMemo(() => ([");
    expect(source).toContain('{ label: "Opened", value: firstOpenRow?.quarter ?? "—" }');
    expect(source).toContain('{ label: "Held for", value: formatHeldYears(latestRow?.holdingDurationQuarters ?? null) }');
    expect(source).toContain('{ label: "P&L", value: "—" }');
    expect(source).not.toContain("Weight / rank");
    expect(source).not.toContain("Selected from");
    expect(source).not.toContain("CardTitle");
    expect(source).not.toContain("SuperinvestorAssetHistoryChart");
  });
});
