"use client";

import { useMemo } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { investorDrilldownCollection, type InvestorDetail } from "@/collections/investor-details";

interface DebugDrilldownRow {
  id: number;
  quarter: string;
  action: "open" | "close";
  cik: string;
  cikName: string;
  cusip: string | null;
}

interface InvestorActivityDrilldownDebugTableProps {
  ticker: string;
}

export function InvestorActivityDrilldownDebugTable({
  ticker,
}: InvestorActivityDrilldownDebugTableProps) {
  if (!import.meta.env.DEV) return null;

  const live = useLiveQuery((q) =>
    q
      .from({ rows: investorDrilldownCollection })
      .select(({ rows }) => rows)
  );

  const rows: DebugDrilldownRow[] = useMemo(() => {
    const source: InvestorDetail[] = (live?.data ?? []).filter((r) => r.ticker === ticker);
    return source.map((item, index) => ({
      id: index,
      quarter: item.quarter,
      action: item.action,
      cik: item.cik,
      cikName: item.cikName,
      cusip: item.cusip,
    }));
  }, [live]);

  const columns: ColumnDef<DebugDrilldownRow>[] = useMemo(
    () => [
      {
        key: "quarter",
        header: "Quarter",
        sortable: true,
      },
      {
        key: "action",
        header: "Action",
        sortable: true,
      },
      {
        key: "cikName",
        header: "Superinvestor",
        sortable: true,
        searchable: true,
      },
      {
        key: "cik",
        header: "CIK",
        sortable: true,
        searchable: true,
      },
      {
        key: "cusip",
        header: "CUSIP",
        sortable: true,
        searchable: true,
      },
    ],
    []
  );

  const totalCount = rows.length;

  return (
    <Card className="mt-6 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Debug: Loaded drill-down rows for {ticker}</span>
          <span className="text-xs font-normal text-muted-foreground">Total rows: {totalCount}</span>
        </CardTitle>
        <CardDescription className="text-xs">
          This shows all investor-detail rows currently cached in TanStack DB for this asset
          (all quarters and actions), including data loaded in the background.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="text-xs text-muted-foreground py-4">
            No drill-down rows have been loaded yet for this asset.
          </div>
        ) : (
          <DataTable
            data={rows}
            columns={columns}
            searchPlaceholder="Filter debug drill-down rows..."
            defaultPageSize={10}
            defaultSortColumn="quarter"
            defaultSortDirection="asc"
            totalCount={totalCount}
          />
        )}
      </CardContent>
    </Card>
  );
}
