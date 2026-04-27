import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, type ColumnDef } from "./DataTable";
import { GlobalSearchInput } from "./global-search/GlobalSearchInput";
import { UFuzzyGlobalSearch } from "./UFuzzyGlobalSearch";

describe("search inputs", () => {
  test("global search input matches the app placeholder and provides a stable form name", () => {
    const html = renderToStaticMarkup(
      <GlobalSearchInput
        query=""
        onChange={() => undefined}
        onKeyDown={() => undefined}
      />,
    );

    expect(html).toContain('name="global-search"');
    expect(html).toContain('placeholder="Search superinvestors, tickers..."');
  });

  test("global search input accepts custom identifiers for alternate search surfaces", () => {
    const html = renderToStaticMarkup(
      <GlobalSearchInput
        query=""
        onChange={() => undefined}
        onKeyDown={() => undefined}
        id="global-search-ufuzzy"
        name="global-search-ufuzzy"
        placeholder="Search superinvestors, tickers..."
      />,
    );

    expect(html).toContain('id="global-search-ufuzzy"');
    expect(html).toContain('name="global-search-ufuzzy"');
    expect(html).toContain('placeholder="Search superinvestors, tickers..."');
  });

  test("global search input can render as a mobile drawer field with GitHub-like full-width density", () => {
    const html = renderToStaticMarkup(
      <GlobalSearchInput
        query=""
        onChange={() => undefined}
        onKeyDown={() => undefined}
        id="global-search-mobile"
        name="global-search-mobile"
        className="h-11 w-full rounded-md"
      />,
    );

    expect(html).toContain('id="global-search-mobile"');
    expect(html).toContain('name="global-search-mobile"');
    expect(html).toContain('class="');
    expect(html).toContain('h-11');
    expect(html).toContain('w-full');
  });

  test("mobile global search can request the shell to close after a result selection", () => {
    const html = renderToStaticMarkup(
      <UFuzzyGlobalSearch
        mode="mobile-drawer"
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain('id="global-search-mobile"');
  });

  test("data table search input provides a stable form name", () => {
    const columns: ColumnDef<{ id: string; name: string }>[] = [
      {
        key: "name",
        header: "Name",
        searchable: true,
      },
    ];

    const html = renderToStaticMarkup(
      <DataTable
        data={[{ id: "1", name: "Alpha" }]}
        columns={columns}
        searchPlaceholder="Search rows..."
      />,
    );

    expect(html).toContain('name="data-table-search"');
    expect(html).toContain('appearance-none');
    expect(html).toContain('focus-visible:ring-transparent');
    expect(html).toContain('[&amp;::-webkit-search-decoration]:appearance-none');
  });
});
