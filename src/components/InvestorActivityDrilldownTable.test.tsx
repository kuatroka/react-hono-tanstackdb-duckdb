import { afterEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";

function registerModuleMocks() {
  mock.module("@tanstack/react-router", () => ({
    Link: ({ children }: { children?: ReactNode }) => children,
  }));

  mock.module("@tanstack/react-db", () => ({
    useLiveQuery: () => {
      throw new Error(
        'Invalid source for live query: The value provided for alias "rows" is not a Collection or subquery...'
      );
    },
  }));

  mock.module("@/components/ui/card", () => ({
    Card: ({ children }: { children?: ReactNode }) => children,
    CardContent: ({ children }: { children?: ReactNode }) => children,
    CardDescription: ({ children }: { children?: ReactNode }) => children,
    CardHeader: ({ children }: { children?: ReactNode }) => children,
    CardTitle: ({ children }: { children?: ReactNode }) => children,
  }));

  mock.module("@/components/LatencyBadge", () => ({
    LatencyBadge: () => null,
  }));

  mock.module("@/components/VirtualDataTable", () => ({
    VirtualDataTable: () => null,
  }));

  mock.module("@/collections/investor-details", () => ({
    fetchDrilldownBothActions: async () => ({ rows: [], queryTimeMs: 0 }),
    backgroundLoadAllDrilldownData: async () => undefined,
    getDrilldownDataFromCollection: () => [],
    investorDrilldownCollection: { entries: () => [] },
    loadDrilldownFromIndexedDB: async () => false,
    isDrilldownIndexedDBLoaded: () => false,
    clearAllDrilldownData: () => undefined,
  }));
}

afterEach(() => {
  mock.restore();
});

describe("InvestorActivityDrilldownTable", () => {
  test("renders without depending on live query sources", async () => {
    registerModuleMocks();
    const { InvestorActivityDrilldownTable } = await import("./InvestorActivityDrilldownTable");

    expect(() => renderToString(
      <InvestorActivityDrilldownTable
        ticker="VII"
        cusip="81786A107"
        quarter="2024-Q4"
        action="open"
      />,
    )).not.toThrow();
  });

  test("uses the virtualized table instead of the paginated DataTable", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain('from "@/components/VirtualDataTable"');
    expect(source).toContain("<VirtualDataTable");
    expect(source).not.toContain('from "@/components/DataTable"');
    expect(source).not.toContain("<DataTable");
  });
});
