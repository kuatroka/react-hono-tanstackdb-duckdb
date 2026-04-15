import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..", "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("VirtualDataTable layout", () => {
  test("renders the header search control on the left and the latency badge in a fixed right slot", () => {
    const source = readProjectFile("src/components/VirtualDataTable.tsx");

    const headerSearchIndex = source.indexOf("function VirtualTableHeaderSearch(");
    const buttonIndex = source.indexOf("<Button", headerSearchIndex);
    const searchInputIndex = source.indexOf("<VirtualTableSearchInput", headerSearchIndex);
    const telemetrySlotIndex = source.indexOf("HeaderTelemetrySlot", headerSearchIndex);
    const justifyBetweenIndex = source.indexOf("justify-between", headerSearchIndex);
    const minWidthIndex = source.indexOf("min-w-[11rem]", source.indexOf("HeaderTelemetrySlot"));
    const searchEnterHandlerIndex = source.indexOf("const handleSearchEnter = useCallback(");
    const activateRowElementIndex = source.indexOf("const activateRowElement = useCallback(");

    expect(headerSearchIndex).toBeGreaterThan(-1);
    expect(justifyBetweenIndex).toBeGreaterThan(-1);
    expect(minWidthIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(-1);
    expect(searchInputIndex).toBeGreaterThan(-1);
    expect(telemetrySlotIndex).toBeGreaterThan(-1);
    expect(searchEnterHandlerIndex).toBeGreaterThan(-1);
    expect(activateRowElementIndex).toBeGreaterThan(-1);
    // Prevent temporal-dead-zone regressions: handleSearchEnter must be declared after activateRowElement
    expect(activateRowElementIndex).toBeLessThan(searchEnterHandlerIndex);
    expect(buttonIndex).toBeLessThan(searchInputIndex);
    expect(searchInputIndex).toBeLessThan(telemetrySlotIndex);
  });
});
