import { useMemo, useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { VirtualDataTable, type ColumnDef } from "@/components/VirtualDataTable";
import type { PerfTelemetry } from "@/lib/perf/telemetry";
import {
  fetchDrilldownBothActions,
  getDrilldownDataFromCollection,
  loadDrilldownFromIndexedDB,
  isDrilldownIndexedDBLoaded,
  type InvestorDetail
} from "@/collections/investor-details";

type InvestorActivityAction = "open" | "close";

interface InvestorActivityDrilldownRow {
  id: string;
  cik: string;
  cikName: string;
  cikTicker: string;
  cusip: string | null;
  quarter: string;
  action: InvestorActivityAction;
}

interface InvestorActivityDrilldownTableProps {
  ticker: string;
  cusip: string;
  quarter: string;
  action: InvestorActivityAction;
}

function getCachedDrilldownRows(
  enabled: boolean,
  ticker: string,
  cusip: string,
  quarter: string,
  action: InvestorActivityAction,
) {
  if (!enabled) {
    return [] as InvestorDetail[];
  }

  return getDrilldownDataFromCollection(ticker, cusip, quarter, action) ?? [];
}

export function InvestorActivityDrilldownTable({
  ticker,
  cusip,
  quarter,
  action,
}: InvestorActivityDrilldownTableProps) {
  const enabled = Boolean(ticker && cusip && quarter);

  const initialCachedRows = getCachedDrilldownRows(enabled, ticker, cusip, quarter, action);
  const hasInitialCachedRows = initialCachedRows.length > 0;

  // State for data, loading, and timing
  const [data, setData] = useState<InvestorDetail[]>(() => initialCachedRows);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(() => (hasInitialCachedRows ? 0 : null));
  const [dataFlow, setDataFlow] = useState<DataFlow>(() => (hasInitialCachedRows ? "tsdb-memory" : "unknown"));
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const prevDataLengthRef = useRef<number>(0);
  const [tableTelemetry, setTableTelemetry] = useState<PerfTelemetry | null>(null);

  // Load from IndexedDB first, then fetch if missing
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      // Track if it was already loaded before we await
      const wasAlreadyLoaded = isDrilldownIndexedDBLoaded();
      const startedAt = performance.now();

      // Try to load from IndexedDB first
      const loadedFromIDB = await loadDrilldownFromIndexedDB();
      const elapsedMs = Math.round(performance.now() - startedAt);
      
      if (cancelled) return;

      // Check if data is now available in collection
      const localRows = getCachedDrilldownRows(enabled, ticker, cusip, quarter, action);
      if (localRows && localRows.length > 0) {
        setData(localRows);
        if (!wasAlreadyLoaded && loadedFromIDB) {
          setQueryTimeMs(elapsedMs);
          setDataFlow("tsdb-indexeddb");
        } else {
          setQueryTimeMs(0);
          setDataFlow("tsdb-memory");
        }
        return;
      }

      // If still no data, fetch from API
      setIsLoading(true);
      setIsError(false);

      try {
        const result = await fetchDrilldownBothActions(ticker, cusip, quarter);
        if (cancelled) return;
        const filtered = result.rows.filter((r) => r.action === action);
        setData(filtered);
        setQueryTimeMs(result.queryTimeMs);
        setDataFlow(result.queryTimeMs === 0 ? "tsdb-memory" : "api-duckdb");
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch drilldown data:", err);
        setIsError(true);
        setData([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, ticker, cusip, quarter, action]);

  // Refresh local data from collection-backed cache when selection changes
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const localRows = getCachedDrilldownRows(enabled, ticker, cusip, quarter, action);
    if (localRows && localRows.length > 0) {
      setData(localRows);
      setDataFlow("tsdb-memory");
      setQueryTimeMs((current) => current ?? 0);
      setIsError(false);
    }
  }, [enabled, ticker, cusip, quarter, action]);

  // Track render timing when data changes
  useEffect(() => {
    if (data.length > 0 && data.length !== prevDataLengthRef.current) {
      renderStartRef.current = performance.now();
      prevDataLengthRef.current = data.length;
    }
  }, [action, data, quarter, ticker]);

  // Measure render time after paint
  useEffect(() => {
    if (renderStartRef.current != null && data.length > 0) {
      const rafId = requestAnimationFrame(() => {
        if (renderStartRef.current != null) {
          const elapsed = Math.round(performance.now() - renderStartRef.current);
          setRenderMs(elapsed);
          renderStartRef.current = null;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [action, data, quarter, ticker]);
  const rows = useMemo(() => {
    return data.map((item: InvestorDetail) => ({
      id: item.id,
      cik: item.cik,
      cikName: item.cikName,
      cikTicker: item.cikTicker,
      cusip: item.cusip,
      quarter: item.quarter,
      action: item.action,
    }));
  }, [data]);

  const columns: ColumnDef<InvestorActivityDrilldownRow>[] = useMemo(
    () => [
      {
        key: "cikName",
        header: "Superinvestor",
        sortable: true,
        searchable: true,
        clickable: true,
        render: (value, row, isFocused) => (
          <Link
            to="/superinvestors/$cik"
            params={{ cik: row.cik }}
            className={`hover:underline underline-offset-4 cursor-pointer text-foreground outline-none ${
              isFocused ? "underline" : ""
            }`}
          >
            {value || "(Unknown)"}
          </Link>
        ),
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
      {
        key: "quarter",
        header: "Quarter",
        sortable: true,
      },
    ],
    []
  );

  if (!enabled) {
    return null;
  }

  const titleAction = action === "open" ? "opened" : "closed";
  const hasRows = rows.length > 0;
  const isInitialLoading = isLoading && !hasRows;
  const hasData = data.length > 0 || !isLoading;

  const latencyDisplay = (
    <LatencyBadge
      dataLoadMs={queryTimeMs ?? undefined}
      renderMs={renderMs ?? undefined}
      source={dataFlow}
      variant="inline"
    />
  );

  const cardTitle = `Superinvestors who ${titleAction} positions in ${ticker} (${quarter})`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>{cardTitle}</span>
          <div className="flex flex-col items-end gap-2">
            <div
              data-testid="drilldown-table-telemetry-slot"
              className="flex min-h-8 min-w-[11rem] items-center justify-end"
            >
              {tableTelemetry ? (
                <LatencyBadge telemetry={tableTelemetry} className="min-w-[11rem] justify-end" />
              ) : (
                latencyDisplay
              )}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-[360px]" aria-busy={isInitialLoading}>
          {isInitialLoading ? (
            <div className="flex h-full items-center justify-center py-8 text-muted-foreground">
              Loading drilldown…
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center py-8 text-center text-destructive text-sm">
              Failed to load drilldown data
            </div>
          ) : hasRows ? (
            <VirtualDataTable
              data={rows}
              columns={columns}
              searchPlaceholder="Filter superinvestors..."
              defaultSortColumn="cikName"
              defaultSortDirection="asc"
              gridTemplateColumns="minmax(18rem, 1.8fr) minmax(8rem, 0.8fr) minmax(10rem, 0.9fr) minmax(8rem, 0.7fr)"
              latencySource="tsdb-memory"
              dataSource={dataFlow}
              onTableTelemetryChange={setTableTelemetry}
              tableTelemetryLabel="drilldown table"
              searchTelemetryLabel="search"
              clientPageSize={100}
              visibleRowCount={10}
            />
          ) : hasData ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <p className="font-medium">No detailed data available for this selection.</p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center py-8 text-muted-foreground">
              No superinvestors found for this selection.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
