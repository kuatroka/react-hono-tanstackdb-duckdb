import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, type ColumnDef } from "./DataTable";
import { GlobalSearchInput } from "./global-search/GlobalSearchInput";

describe("search inputs", () => {
  test("global search input matches the app placeholder and provides a stable form name", () => {
    const html = renderToStaticMarkup(
      <GlobalSearchInput
        query=""
        onChange={() => undefined}
        onFocus={() => undefined}
        onKeyDown={() => undefined}
      />,
    );

    expect(html).toContain('name="global-search"');
    expect(html).toContain('placeholder="Search superinvestors, tickers..."');
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
  });
});
