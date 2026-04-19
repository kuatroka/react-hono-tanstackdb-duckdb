import { useMemo, useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { VirtualDataTable, type ColumnDef } from "@/components/VirtualDataTable";
import {
  ASSET_DETAIL_CARD_CLASS_NAME,
  ASSET_DETAIL_CARD_CONTENT_CLASS_NAME,
} from "@/components/detail/asset-detail-card-layout";
import type { PerfTelemetry } from "@/lib/perf/telemetry";
import {
  fetchDrilldownBothActions,
  getDrilldownDataFromCollection,
  loadDrilldownFromIndexedDB,
  isDrilldownIndexedDBLoaded,
  type InvestorDetail
} from "@/collections/investor-details";

type InvestorActivityAction = "open" | "close";
const DRILLDOWN_LOADING_PLACEHOLDER_DELAY_MS = 120;

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
  const [isLoading, setIsLoading] = useState(() => !hasInitialCachedRows);
  const [showLoadingState, setShowLoadingState] = useState(false);
  const [isError, setIsError] = useState(false);
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(() => (hasInitialCachedRows ? 0 : null));
  const [dataFlow, setDataFlow] = useState<DataFlow>(() => (hasInitialCachedRows ? "tsdb-memory" : "unknown"));
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const prevDataLengthRef = useRef<number>(0);
  const [tableTelemetry, setTableTelemetry] = useState<PerfTelemetry | null>(null);

  // Load current selection as fast as possible by letting IndexedDB hydration and
  // the quarter fetch race each other, then measure the full user-visible wait.
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let resolved = false;
    let waitingForIndexedDB = !isDrilldownIndexedDBLoaded();
    let pendingFetchError: unknown = null;
    const startedAt = performance.now();
    const loadingTimeoutId = setTimeout(() => {
      if (!cancelled && !resolved) {
        setShowLoadingState(true);
      }
    }, DRILLDOWN_LOADING_PLACEHOLDER_DELAY_MS);

    const resolveLoadMs = () => Math.round(performance.now() - startedAt);
    const finishWithRows = (rows: InvestorDetail[], source: DataFlow) => {
      if (cancelled || resolved || rows.length === 0) {
        return false;
      }

      resolved = true;
      clearTimeout(loadingTimeoutId);
      setData(rows);
      setQueryTimeMs(resolveLoadMs());
      setDataFlow(source);
      setIsError(false);
      setIsLoading(false);
      setShowLoadingState(false);
      return true;
    };

    const finishEmpty = (source: DataFlow) => {
      if (cancelled || resolved) {
        return;
      }

      resolved = true;
      clearTimeout(loadingTimeoutId);
      setData([]);
      setQueryTimeMs(resolveLoadMs());
      setDataFlow(source);
      setIsError(false);
      setIsLoading(false);
      setShowLoadingState(false);
    };

    const finishError = (error: unknown) => {
      if (cancelled || resolved) {
        return;
      }

      resolved = true;
      clearTimeout(loadingTimeoutId);
      console.error("Failed to fetch drilldown data:", error);
      setIsError(true);
      setData([]);
      setQueryTimeMs(resolveLoadMs());
      setIsLoading(false);
      setShowLoadingState(false);
    };

    const initialRows = getCachedDrilldownRows(enabled, ticker, cusip, quarter, action);
    if (finishWithRows(initialRows, "tsdb-memory")) {
      return () => {
        cancelled = true;
        clearTimeout(loadingTimeoutId);
      };
    }

    setIsLoading(true);
    setShowLoadingState(false);
    setIsError(false);

    void fetchDrilldownBothActions(ticker, cusip, quarter)
      .then((result) => {
        const filtered = result.rows.filter((row) => row.action === action);
        const source = result.queryTimeMs === 0 ? "tsdb-memory" : "api-duckdb";

        if (finishWithRows(filtered, source)) {
          return;
        }

        if (!waitingForIndexedDB) {
          finishEmpty(source);
        }
      })
      .catch((error) => {
        if (!waitingForIndexedDB) {
          finishError(error);
          return;
        }

        pendingFetchError = error;
      });

    if (waitingForIndexedDB) {
      void loadDrilldownFromIndexedDB()
        .then((loadedFromIDB) => {
          waitingForIndexedDB = false;

          const localRows = getCachedDrilldownRows(enabled, ticker, cusip, quarter, action);
          if (finishWithRows(localRows, loadedFromIDB ? "tsdb-indexeddb" : "tsdb-memory")) {
            return;
          }

          if (pendingFetchError) {
            finishError(pendingFetchError);
          }
        })
        .catch((error) => {
          waitingForIndexedDB = false;

          if (pendingFetchError) {
            finishError(pendingFetchError);
            return;
          }

          console.error("Failed to load drilldown data from IndexedDB:", error);
        });
    }

    return () => {
      cancelled = true;
      clearTimeout(loadingTimeoutId);
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
      setIsLoading(false);
      setShowLoadingState(false);
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
            preload={false}
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
  const isInitialLoading = showLoadingState && isLoading && !hasRows;
  const hasResolvedEmptyState = !hasRows && !isLoading && !isError;

  const latencyDisplay = (
    <LatencyBadge
      dataLoadMs={queryTimeMs ?? undefined}
      renderMs={renderMs ?? undefined}
      source={dataFlow}
      variant="inline"
    />
  );
  const resolvedHeaderLatencyBadge = queryTimeMs != null || renderMs != null
    ? latencyDisplay
    : tableTelemetry ? (
        <LatencyBadge telemetry={tableTelemetry} className="min-w-[11rem] justify-end" />
      ) : null;

  const cardTitle = `Superinvestors who ${titleAction} positions in ${ticker} (${quarter})`;

  return (
    <Card className={ASSET_DETAIL_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span>{cardTitle}</span>
          <div className="flex flex-col items-end gap-2">
            <div
              data-testid="drilldown-table-telemetry-slot"
              className="flex min-h-8 min-w-[11rem] items-center justify-end"
            >
              {resolvedHeaderLatencyBadge}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className={ASSET_DETAIL_CARD_CONTENT_CLASS_NAME}>
        <div className="relative flex-1 h-full w-full min-w-0" aria-busy={isInitialLoading}>
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
              gridTemplateColumns="minmax(0, 1.8fr) minmax(4rem, 0.75fr) minmax(5.5rem, 0.9fr) minmax(4.5rem, 0.8fr)"
              latencySource="tsdb-memory"
              dataSource={dataFlow}
              onTableTelemetryChange={setTableTelemetry}
              tableTelemetryLabel="drilldown table"
              searchTelemetryLabel="search"
              clientPageSize={100}
              visibleRowCount={6}
            />
          ) : hasResolvedEmptyState ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center text-muted-foreground space-y-2">
              <p className="font-medium">No detailed data available for this selection.</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
