import { useMemo, useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { DataTable, ColumnDef } from "@/components/DataTable";
import {
  fetchDrilldownBothActions,
  getDrilldownDataFromCollection,
  investorDrilldownCollection,
  loadDrilldownFromIndexedDB,
  isDrilldownIndexedDBLoaded,
  type InvestorDetail
} from "@/collections/investor-details";

type InvestorActivityAction = "open" | "close";

interface InvestorActivityDrilldownRow {
  id: number;
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

export function InvestorActivityDrilldownTable({
  ticker,
  cusip,
  quarter,
  action,
}: InvestorActivityDrilldownTableProps) {
  const enabled = Boolean(ticker && cusip && quarter);

  // State for data, loading, and timing
  const [data, setData] = useState<InvestorDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);
  const [dataFlow, setDataFlow] = useState<DataFlow>("unknown");
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const prevDataLengthRef = useRef<number>(0);

  // Subscribe to the collection for this slice
  const slice = useLiveQuery((q) =>
    q
      .from({ rows: investorDrilldownCollection })
      .select(({ rows }) => rows)
  );

  // Track render timing when data changes
  useEffect(() => {
    if (data.length > 0 && data.length !== prevDataLengthRef.current) {
      renderStartRef.current = performance.now();
      prevDataLengthRef.current = data.length;
    }
  }, [data]);

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
  }, [data]);

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
      const localRows = getDrilldownDataFromCollection(ticker, cusip, quarter, action);
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

  // Keep data in sync with live query (instant updates once present)
  useEffect(() => {
    if (slice?.data && slice.data.length > 0) {
      const filtered = slice.data.filter(
        (r: InvestorDetail) => r.ticker === ticker && r.cusip === cusip && r.quarter === quarter && r.action === action
      );
      if (filtered.length > 0) {
        setData(filtered);
        setDataFlow("tsdb-memory");
        if (queryTimeMs === null) setQueryTimeMs(0);
      }
    }
  }, [slice, queryTimeMs, ticker, cusip, quarter, action]);

  // Transform data to display format
  const rows = useMemo(() => {
    console.debug(
      `[DrilldownTable] rendering ${data.length} rows for ${ticker} ${quarter} ${action}`
    );
    return data.map((item: InvestorDetail, index: number) => ({
      id: index,
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

  const totalCount = rows.length;
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
        <CardTitle className="flex items-center justify-between">
          <span>{cardTitle}</span>
          {latencyDisplay}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-[450px]" aria-busy={isInitialLoading}>
          {isInitialLoading ? (
            <div className="flex h-full items-center justify-center py-8 text-muted-foreground">
              Loading drilldown…
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center py-8 text-center text-destructive text-sm">
              Failed to load drilldown data
            </div>
          ) : hasRows ? (
            <DataTable
              data={rows}
              columns={columns}
              searchPlaceholder="Filter superinvestors..."
              defaultPageSize={10}
              defaultSortColumn="cikName"
              defaultSortDirection="asc"
              totalCount={totalCount}
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
