import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, type ColumnDef } from "./DataTable";

interface SampleRow {
  id: string;
  name: string;
  code: string;
}

describe("DataTable virtualization", () => {
  test("renders a TanStack-virtualized scroll container instead of pagination controls", () => {
    const columns: ColumnDef<SampleRow>[] = [
      {
        key: "name",
        header: "Name",
        sortable: true,
        searchable: true,
      },
      {
        key: "code",
        header: "Code",
        sortable: true,
        searchable: true,
      },
    ];

    const html = renderToStaticMarkup(
      <DataTable
        data={Array.from({ length: 25 }, (_, index) => ({
          id: String(index + 1),
          name: `Investor ${index + 1}`,
          code: `C${index + 1}`,
        }))}
        columns={columns}
        searchPlaceholder="Search rows..."
        defaultSortColumn="name"
      />,
    );

    expect(html).toContain('data-testid="data-table-virtual-scroll-container"');
    expect(html).toContain("Showing 1-25 of 25 row(s)");
    expect(html).not.toContain("Rows per page:");
    expect(html).not.toContain("Page 1 of");
  });
});
