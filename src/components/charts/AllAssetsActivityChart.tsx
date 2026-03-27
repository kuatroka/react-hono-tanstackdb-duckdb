"use client";

import { useLiveQuery } from "@tanstack/react-db";
import { OpenedClosedBarChart } from "./OpenedClosedBarChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge } from "@/components/LatencyBadge";
import { useMemo } from "react";
import { allAssetsActivityCollection } from "@/collections";

interface AllAssetsActivityChartProps {
  /** Callback when a bar is clicked (optional - for drilldown) */
  onBarClick?: (selection: { quarter: string; action: "open" | "close" }) => void;
}

/**
 * ECharts chart showing aggregated opened/closed positions across ALL assets by quarter.
 * Data is fetched from DuckDB via /api/all-assets-activity endpoint.
 */
export function AllAssetsActivityChart({ onBarClick }: AllAssetsActivityChartProps) {
  const { data: rows, isLoading } = useLiveQuery((q) =>
    q.from({ rows: allAssetsActivityCollection })
  );

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => a.quarter.localeCompare(b.quarter));
  }, [rows]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All Assets Activity (ECharts)</CardTitle>
          <CardDescription>Loading activity data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[450px] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <OpenedClosedBarChart
      data={sortedRows}
      title="All Assets Activity (ECharts)"
      description="Total opened (green) and closed (red) positions across all assets by quarter"
      onBarClick={onBarClick}
      latencyBadge={<LatencyBadge latencyMs={0} source="tsdb-indexeddb" />}
      unitLabel="positions"
    />
  );
}
