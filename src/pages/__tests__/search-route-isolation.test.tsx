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

interface CapturedDataTableProps<TRow> {
  initialPage: number;
  searchValue: string;
  searchDisabled: boolean;
  data: TRow[];
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
}

interface NavigatePayload {
  to: "/assets" | "/superinvestors";
  search: {
    page: string;
    search: string;
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

  test("assets route derives table state and navigation behavior from URL search params at runtime", async () => {
    const navigateCalls: NavigatePayload[] = [];
    let capturedDataTableProps: CapturedDataTableProps<AssetRow> | undefined;

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

    mock.module("@/components/DataTable", () => ({
      DataTable: (props: CapturedDataTableProps<AssetRow>) => {
        capturedDataTableProps = props;
        return React.createElement("div", { "data-testid": "assets-table" });
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

    expect(html).toContain("assets-table");
    expect(capturedDataTableProps).toBeDefined();
    expect(capturedDataTableProps?.initialPage).toBe(3);
    expect(capturedDataTableProps?.searchValue).toBe("abc");
    expect(capturedDataTableProps?.searchDisabled).toBe(true);
    expect(capturedDataTableProps?.data).toHaveLength(1);
    expect(capturedDataTableProps?.data[0].asset).toBe("ABC");

    capturedDataTableProps?.onPageChange(5);
    capturedDataTableProps?.onSearchChange("  xyz  ");

    expect(navigateCalls).toEqual([
      { to: "/assets", search: { page: "5", search: "abc" } },
      { to: "/assets", search: { page: "1", search: "xyz" } },
    ]);
  });

  test("superinvestors route derives table state and navigation behavior from URL search params at runtime", async () => {
    const navigateCalls: NavigatePayload[] = [];
    let capturedDataTableProps: CapturedDataTableProps<SuperinvestorRow> | undefined;

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

    mock.module("@/components/DataTable", () => ({
      DataTable: (props: CapturedDataTableProps<SuperinvestorRow>) => {
        capturedDataTableProps = props;
        return React.createElement("div", { "data-testid": "superinvestors-table" });
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

    expect(html).toContain("superinvestors-table");
    expect(capturedDataTableProps).toBeDefined();
    expect(capturedDataTableProps?.initialPage).toBe(4);
    expect(capturedDataTableProps?.searchValue).toBe("alpha");
    expect(capturedDataTableProps?.searchDisabled).toBe(true);
    expect(capturedDataTableProps?.data).toHaveLength(1);
    expect(capturedDataTableProps?.data[0].cik).toBe("0001");

    capturedDataTableProps?.onPageChange(2);
    capturedDataTableProps?.onSearchChange("  0002  ");

    expect(navigateCalls).toEqual([
      { to: "/superinvestors", search: { page: "2", search: "alpha" } },
      { to: "/superinvestors", search: { page: "1", search: "0002" } },
    ]);
  });
});
