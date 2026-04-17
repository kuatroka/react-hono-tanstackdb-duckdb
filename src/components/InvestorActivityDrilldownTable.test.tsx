import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";

type InvestorDetailRow = {
  id: string;
  ticker: string;
  cik: string;
  cikName: string;
  cikTicker: string;
  quarter: string;
  cusip: string | null;
  action: "open" | "close";
};

const cachedRowsByKey = new Map<string, InvestorDetailRow[]>();
const virtualTableProps: Array<Record<string, unknown>> = [];

function makeCacheKey(ticker: string, cusip: string, quarter: string, action: "open" | "close") {
  return `${ticker}:${cusip}:${quarter}:${action}`;
}

function registerModuleMocks() {
  mock.module("@tanstack/react-router", () => ({
    Link: ({ children }: { children?: ReactNode }) => children,
  }));

  mock.module("@/components/ui/card", () => ({
    Card: ({ children }: { children?: ReactNode }) => React.createElement("section", null, children),
    CardContent: ({ children }: { children?: ReactNode }) => React.createElement("div", null, children),
    CardHeader: ({ children }: { children?: ReactNode }) => React.createElement("header", null, children),
    CardTitle: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) =>
      React.createElement("h2", props, children),
  }));

  mock.module("@/components/LatencyBadge", () => ({
    LatencyBadge: ({ telemetry, source }: { telemetry?: { primaryLine?: string } | null; source?: string }) =>
      React.createElement(
        "span",
        {
          "data-testid": telemetry ? "telemetry-badge" : "latency-badge",
          "data-source": source ?? "unknown",
        },
        telemetry?.primaryLine ?? source ?? "latency",
      ),
  }));

  mock.module("@/components/VirtualDataTable", () => ({
    VirtualDataTable: (props: Record<string, unknown>) => {
      virtualTableProps.push(props);
      const data = Array.isArray(props.data) ? props.data as Array<{ id: string }> : [];
      return React.createElement("div", {
        "data-testid": "virtual-table",
        "data-row-count": String(data.length),
        "data-row-ids": data.map((row) => row.id).join(","),
      });
    },
  }));

  mock.module("@/collections/investor-details", () => ({
    fetchDrilldownBothActions: async () => ({ rows: [], queryTimeMs: 0 }),
    backgroundLoadAllDrilldownData: async () => undefined,
    getDrilldownDataFromCollection: (
      ticker: string,
      cusip: string,
      quarter: string,
      action: "open" | "close",
    ) => cachedRowsByKey.get(makeCacheKey(ticker, cusip, quarter, action)) ?? null,
    investorDrilldownCollection: { entries: () => [] },
    loadDrilldownFromIndexedDB: async () => false,
    isDrilldownIndexedDBLoaded: () => false,
    clearAllDrilldownData: () => undefined,
  }));
}

describe("InvestorActivityDrilldownTable", () => {
  beforeEach(() => {
    mock.restore();
    cachedRowsByKey.clear();
    virtualTableProps.length = 0;
    registerModuleMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  test("renders without crashing when the collection cache has not been populated yet", async () => {
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

  test("renders cached drilldown rows on first paint without a loading placeholder", async () => {
    cachedRowsByKey.set(makeCacheKey("VII", "81786A107", "2024-Q4", "open"), [
      {
        id: "81786A107-2024-Q4-open-0001",
        ticker: "VII",
        cik: "0001",
        cikName: "Alpha Capital",
        cikTicker: "ALPHA",
        quarter: "2024-Q4",
        cusip: "81786A107",
        action: "open",
      },
      {
        id: "81786A107-2024-Q4-open-0002",
        ticker: "VII",
        cik: "0002",
        cikName: "Bravo Capital",
        cikTicker: "BRAVO",
        quarter: "2024-Q4",
        cusip: "81786A107",
        action: "open",
      },
    ]);

    const { InvestorActivityDrilldownTable } = await import("./InvestorActivityDrilldownTable");
    const html = renderToString(
      <InvestorActivityDrilldownTable
        ticker="VII"
        cusip="81786A107"
        quarter="2024-Q4"
        action="open"
      />,
    );

    expect(html).toContain('data-testid="virtual-table"');
    expect(html).toContain('data-row-count="2"');
    expect(html).toContain("81786A107-2024-Q4-open-0001,81786A107-2024-Q4-open-0002");
    expect(html).not.toContain("Loading drilldown");
    expect(html).not.toContain("No detailed data available for this selection.");
    expect(virtualTableProps[0]?.data).toEqual([
      expect.objectContaining({ id: "81786A107-2024-Q4-open-0001" }),
      expect.objectContaining({ id: "81786A107-2024-Q4-open-0002" }),
    ]);
  });

  test("renders the fixed table telemetry slot in the header before telemetry badges are ready", async () => {
    cachedRowsByKey.set(makeCacheKey("VII", "81786A107", "2024-Q4", "open"), [
      {
        id: "81786A107-2024-Q4-open-0001",
        ticker: "VII",
        cik: "0001",
        cikName: "Alpha Capital",
        cikTicker: "ALPHA",
        quarter: "2024-Q4",
        cusip: "81786A107",
        action: "open",
      },
    ]);

    const { InvestorActivityDrilldownTable } = await import("./InvestorActivityDrilldownTable");
    const html = renderToString(
      <InvestorActivityDrilldownTable
        ticker="VII"
        cusip="81786A107"
        quarter="2024-Q4"
        action="open"
      />,
    );

    expect(html).toContain('data-testid="drilldown-table-telemetry-slot"');
  });

  test("keeps search telemetry inside the table header instead of duplicating it in the card title", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain("const [tableTelemetry, setTableTelemetry]");
    expect(source).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(source).not.toContain('data-testid="drilldown-search-telemetry-slot"');
    expect(source).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
  });

  test("uses the virtualized table instead of the paginated DataTable", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain('from "@/components/VirtualDataTable"');
    expect(source).toContain("<VirtualDataTable");
    expect(source).not.toContain('from "@/components/DataTable"');
    expect(source).not.toContain("<DataTable");
  });
});
