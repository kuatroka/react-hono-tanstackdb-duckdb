import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("drilldown style parity", () => {
  test("pins shared border tokens on cards, table rows, and hover placeholders", () => {
    const cardPrimitive = readProjectFile("src/components/ui/card.tsx");
    const tablePrimitive = readProjectFile("src/components/ui/table.tsx");
    const assetDrilldown = readProjectFile("src/components/detail/AssetDrilldownSection.tsx");
    const appCss = readProjectFile("src/index.css");

    expect(cardPrimitive).toContain("border border-border");
    expect(tablePrimitive).toContain("border-b border-border transition-colors");
    expect(assetDrilldown).toContain("rounded-lg border border-border bg-card py-8 text-center text-muted-foreground");
    expect(appCss).toContain("font-family: var(--font-sans);");
  });
});
