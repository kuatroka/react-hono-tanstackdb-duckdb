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

  mock.module("@/components/ui/button", () => ({
    Button: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) =>
      React.createElement("button", props, children),
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

  mock.module("@/components/detail/SuperinvestorAssetHistorySection", () => ({
    SuperinvestorAssetHistorySection: ({ investor }: { investor: { cik?: string } }) =>
      React.createElement("div", { "data-testid": "inline-history", "data-cik": investor?.cik ?? "" }),
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
    clearDrilldownSessionState: () => undefined,
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
    expect(source).toContain('searchStrategy="ufuzzy"');
    expect(source).toContain('mode: "name-only"');
    expect(source).toContain("getName: (row) => row.cikName");
    expect(source).not.toContain("const [searchTelemetry, setSearchTelemetry]");
    expect(source).not.toContain('data-testid="drilldown-search-telemetry-slot"');
    expect(source).not.toContain("onSearchTelemetryChange={setSearchTelemetry}");
  });

  test("disables route preloading for drilldown superinvestor links", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain('to="/superinvestors/$cik"');
    expect(source).toContain("preload={false}");
  });

  test("configures inline expanded rows for investor history drilldown", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain("expandedRowKey={expandedInvestorCik}");
    expect(source).toContain("getRowKey={(row) => row.cik}");
    expect(source).toContain("renderExpandedRow={(row) => (");
    expect(source).toContain("SuperinvestorAssetHistorySection");
  });

  test("keeps the end-to-end drilldown latency badge visible instead of replacing it with table-only telemetry", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain("const resolvedHeaderLatencyBadge = queryTimeMs != null || renderMs != null");
    expect(source).toContain("? latencyDisplay");
    expect(source).toContain(": tableTelemetry ? (");
  });

  test("shows six visible rows with placeholder pnl, value, and weight columns plus trailing chevron", async () => {
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
    renderToString(
      <InvestorActivityDrilldownTable
        ticker="VII"
        cusip="81786A107"
        quarter="2024-Q4"
        action="open"
      />,
    );

    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();
    const columns = virtualTableProps[0]?.columns as Array<{ key: string; header: string }> | undefined;

    expect(virtualTableProps[0]?.visibleRowCount).toBe(6);
    expect(virtualTableProps[0]?.gridTemplateColumns).toBe("minmax(0, 1.6fr) minmax(6rem, 0.55fr) minmax(6rem, 0.6fr) minmax(6rem, 0.55fr) 3rem");
    expect(columns?.map((column) => column.key)).toEqual(["cikName", "quarter", "cusip", "cikTicker", "action"]);
    expect(columns?.map((column) => column.header)).toEqual(["Superinvestor", "VII P&L%", "Value", "Weight%", ""]);
    expect(source).not.toContain('header: "CIK"');
    expect(source).not.toContain('header: "CUSIP"');
    expect(source).not.toContain('header: "Journey"');
    expect(source).toContain("className={ASSET_DETAIL_CARD_CLASS_NAME}");
    expect(source).toContain("className={ASSET_DETAIL_CARD_CONTENT_CLASS_NAME}");
    expect(source).toContain('className="relative flex-1 h-full w-full min-w-0"');
  });

  test("uses the virtualized table instead of the paginated DataTable", async () => {
    const source = await Bun.file(new URL("./InvestorActivityDrilldownTable.tsx", import.meta.url)).text();

    expect(source).toContain('from "@/components/VirtualDataTable"');
    expect(source).toContain("<VirtualDataTable");
    expect(source).not.toContain('from "@/components/DataTable"');
    expect(source).not.toContain("<DataTable");
  });
});
