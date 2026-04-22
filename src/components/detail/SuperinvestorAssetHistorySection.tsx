import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { type SuperinvestorAssetHistoryRow } from "@/collections/superinvestor-asset-history";
import { useSuperinvestorAssetHistoryData } from "./useSuperinvestorAssetHistoryData";

interface SuperinvestorAssetHistorySectionProps {
  ticker: string;
  cusip: string;
  investor: {
    cik: string;
    cikName: string;
    quarter: string;
    action: "open" | "close";
  };
}

function formatHeldYears(quarters: number | null) {
  if (quarters == null || quarters <= 0) {
    return "—";
  }

  const years = quarters / 4;
  const displayYears = Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1).replace(/\.0$/, "");
  return `${displayYears} ${years > 1 ? "yrs" : "yr"}`;
}

export const SuperinvestorAssetHistorySection = memo(function SuperinvestorAssetHistorySection({
  ticker,
  cusip,
  investor,
}: SuperinvestorAssetHistorySectionProps) {
  const { rows: historyRows, isLoading: isHistoryLoading } = useSuperinvestorAssetHistoryData(
    ticker,
    cusip,
    investor.cik,
  );

  const firstOpenRow = useMemo(
    () => historyRows.find((row) => row.action === "open") ?? historyRows[0] ?? null,
    [historyRows],
  );
  const latestRow = useMemo<SuperinvestorAssetHistoryRow | null>(
    () => historyRows.at(-1) ?? null,
    [historyRows],
  );
  const summaryChips = useMemo(() => ([
    { label: "Opened", value: firstOpenRow?.quarter ?? "—" },
    { label: "Held for", value: formatHeldYears(latestRow?.holdingDurationQuarters ?? null) },
    { label: "P&L", value: "—" },
  ]), [firstOpenRow, latestRow]);

  if (isHistoryLoading) {
    return (
      <Card className="min-w-0 border-border/70 shadow-none">
        <CardContent className="space-y-4 py-6 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-3">Loading journey…</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 border-border/70 shadow-none">
      <CardContent className="flex flex-wrap items-center gap-2 py-4">
        {summaryChips.map((chip) => (
          <Badge key={chip.label} variant="outline" className="font-normal">
            {chip.label}: {chip.value}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
});
