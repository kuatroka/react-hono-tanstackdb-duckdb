import React from "react";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

interface AssetRow {
  asset: string;
  assetName: string;
  cusip: string;
}

interface SuperinvestorRow {
  cik: string;
  cikName: string;
}

interface CapturedVirtualTableProps<TRow> {
  data: TRow[];
  searchValue: string;
  searchPlaceholder: string;
  defaultSortColumn: string;
  gridTemplateColumns: string;
  onSearchChange: (value: string) => void;
}

interface NavigatePayload {
  to: "/assets" | "/superinvestors";
  search: {
    search?: string;
  };
}

const projectRoot = join(import.meta.dir, "..", "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

afterEach(() => {
  mock.restore();
});

describe("route search isolation", () => {
  test("global search results consume a local shared type instead of importing from the parent component", () => {
    const globalSearch = readProjectFile("components/DuckDBGlobalSearch.tsx");
    const globalSearchResults = readProjectFile("components/global-search/GlobalSearchResults.tsx");

    expect(globalSearchResults).not.toContain('from "@/components/DuckDBGlobalSearch"');
    expect(globalSearchResults).toContain('from "@/components/global-search/search-result"');
    expect(globalSearch).toContain('from "@/components/global-search/search-result"');
    expect(globalSearch).not.toContain("export interface SearchResult");
  });

  test("assets route derives virtual table state and navigation behavior from URL search params at runtime", async () => {
    const navigateCalls: NavigatePayload[] = [];
    let capturedVirtualTableProps: CapturedVirtualTableProps<AssetRow> | undefined;

    mock.module("@tanstack/react-db", () => ({
      useLiveQuery: () => ({
        data: [
          { asset: "ABC", assetName: "Alphabet Bond", cusip: "111" },
          { asset: "XYZ", assetName: "Zeta Holdings", cusip: "222" },
        ],
        isLoading: false,
      }),
    }));

    mock.module("@tanstack/react-router", () => ({
      Link: ({ children }: { children: React.ReactNode }) => React.createElement("a", { href: "#" }, children),
      useNavigate: () => (payload: NavigatePayload) => {
        navigateCalls.push(payload);
      },
      useSearch: () => ({ page: "3", search: "  abc  " }),
    }));

    mock.module("@/components/VirtualDataTable", () => ({
      VirtualDataTable: (props: CapturedVirtualTableProps<AssetRow>) => {
        capturedVirtualTableProps = props;
        return React.createElement("div", { "data-testid": "assets-virtual-table" });
      },
    }));

    mock.module("@/components/ui/card", () => ({
      Card: ({ children }: { children: React.ReactNode }) => React.createElement("section", null, children),
      CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement("header", null, children),
      CardTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
      CardDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", null, children),
      CardContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
    }));

    mock.module("@/components/charts/AllAssetsActivityChart", () => ({
      AllAssetsActivityChart: () => React.createElement("div", { "data-testid": "assets-chart" }),
    }));

    mock.module("@/hooks/useContentReady", () => ({
      useContentReady: () => ({ onReady: () => {} }),
    }));

    const { AssetsTablePage } = await import("../AssetsTable");
    const html = renderToStaticMarkup(React.createElement(AssetsTablePage));

    expect(html).toContain("assets-virtual-table");
    expect(html).not.toContain("assets-chart");
    expect(capturedVirtualTableProps).toBeDefined();
    expect(capturedVirtualTableProps?.searchValue).toBe("abc");
    expect(capturedVirtualTableProps?.searchPlaceholder).toBe("Search assets...");
    expect(capturedVirtualTableProps?.defaultSortColumn).toBe("assetName");
    expect(capturedVirtualTableProps?.gridTemplateColumns).toContain("minmax(12rem, 1fr)");
    expect(capturedVirtualTableProps?.data).toHaveLength(2);
    expect(capturedVirtualTableProps?.data[0].asset).toBe("ABC");

    capturedVirtualTableProps?.onSearchChange("  xyz  ");

    expect(navigateCalls).toEqual([
      { to: "/assets", search: { search: "xyz" } },
    ]);
  });

  test("superinvestors route derives virtual table state and navigation behavior from URL search params at runtime", async () => {
    const navigateCalls: NavigatePayload[] = [];
    let capturedVirtualTableProps: CapturedVirtualTableProps<SuperinvestorRow> | undefined;

    mock.module("@tanstack/react-db", () => ({
      useLiveQuery: () => ({
        data: [
          { cik: "0001", cikName: "Alpha Capital" },
          { cik: "0002", cikName: "Beta Partners" },
        ],
        isLoading: false,
      }),
    }));

    mock.module("@tanstack/react-router", () => ({
      Link: ({ children }: { children: React.ReactNode }) => React.createElement("a", { href: "#" }, children),
      useNavigate: () => (payload: NavigatePayload) => {
        navigateCalls.push(payload);
      },
      useSearch: () => ({ page: "4", search: "  alpha  " }),
    }));

    mock.module("@/components/VirtualDataTable", () => ({
      VirtualDataTable: (props: CapturedVirtualTableProps<SuperinvestorRow>) => {
        capturedVirtualTableProps = props;
        return React.createElement("div", { "data-testid": "superinvestors-virtual-table" });
      },
    }));

    mock.module("@/components/ui/card", () => ({
      Card: ({ children }: { children: React.ReactNode }) => React.createElement("section", null, children),
      CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement("header", null, children),
      CardTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
      CardDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", null, children),
      CardContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
    }));

    mock.module("@/hooks/useContentReady", () => ({
      useContentReady: () => ({ onReady: () => {} }),
    }));

    const { SuperinvestorsTablePage } = await import("../SuperinvestorsTable");
    const html = renderToStaticMarkup(React.createElement(SuperinvestorsTablePage));

    expect(html).toContain("superinvestors-virtual-table");
    expect(capturedVirtualTableProps).toBeDefined();
    expect(capturedVirtualTableProps?.searchValue).toBe("alpha");
    expect(capturedVirtualTableProps?.searchPlaceholder).toBe("Search superinvestors...");
    expect(capturedVirtualTableProps?.defaultSortColumn).toBe("cikName");
    expect(capturedVirtualTableProps?.gridTemplateColumns).toContain("minmax(12rem, 1fr)");
    expect(capturedVirtualTableProps?.data).toHaveLength(2);
    expect(capturedVirtualTableProps?.data[0].cik).toBe("0001");

    capturedVirtualTableProps?.onSearchChange("  0002  ");

    expect(navigateCalls).toEqual([
      { to: "/superinvestors", search: { search: "0002" } },
    ]);
  });
});
