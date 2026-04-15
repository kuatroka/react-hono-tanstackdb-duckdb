import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { VirtualDataTable, type ColumnDef } from "./VirtualDataTable";

type Row = {
  id: number;
  assetName: string;
};

describe("VirtualDataTable smoke", () => {
  test("renders without temporal-dead-zone wiring errors for header search handlers", () => {
    const data: Row[] = [{ id: 1, assetName: "Alpha" }];

    const columns: ColumnDef<Row>[] = [
      {
        key: "assetName",
        header: "Asset",
        sortable: true,
        searchable: true,
      },
    ];

    expect(() =>
      renderToStaticMarkup(
        <VirtualDataTable<Row>
          data={data}
          columns={columns}
          defaultSortColumn="assetName"
          gridTemplateColumns="minmax(12rem, 1fr) minmax(20rem, 1.5fr)"
        />,
      ),
    ).not.toThrow();
  });
});
