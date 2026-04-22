import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LatencyBadge, type DataFlow } from "@/components/LatencyBadge";
import { VirtualDataTable, type ColumnDef } from "@/components/VirtualDataTable";
import {
  ASSET_DETAIL_CARD_CLASS_NAME,
  ASSET_DETAIL_CARD_CONTENT_CLASS_NAME,
} from "@/components/detail/asset-detail-card-layout";
import { SuperinvestorAssetHistorySection } from "@/components/detail/SuperinvestorAssetHistorySection";
import { Button } from "@/components/ui/button";
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
  const expansionScopeKey = `${ticker}:${cusip}:${quarter}:${action}`;
  const [expandedInvestorState, setExpandedInvestorState] = useState<{ scopeKey: string; cik: string | null }>(() => ({
    scopeKey: expansionScopeKey,
    cik: null,
  }));
  const expandedInvestorCik = expandedInvestorState.scopeKey === expansionScopeKey
    ? expandedInvestorState.cik
    : null;

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

  const handleToggleExpandedInvestor = useCallback((cik: string) => {
    setExpandedInvestorState((current) => ({
      scopeKey: expansionScopeKey,
      cik: current.scopeKey === expansionScopeKey && current.cik === cik ? null : cik,
    }));
  }, [expansionScopeKey]);

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
        key: "quarter",
        header: `${ticker} P&L%`,
        render: () => "—",
        className: "min-w-[6rem]",
      },
      {
        key: "cusip",
        header: "Value",
        render: () => "—",
        className: "min-w-[6rem]",
      },
      {
        key: "cikTicker",
        header: "Weight%",
        render: () => "—",
        className: "min-w-[6rem]",
      },
      {
        key: "action",
        header: "",
        render: (_value, row) => {
          const isExpanded = expandedInvestorCik === row.cik;
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.cikName || row.cik} history`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleToggleExpandedInvestor(row.cik);
              }}
              className="ml-auto h-8 w-8"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          );
        },
        className: "w-10 justify-self-end",
      },
    ],
    [expandedInvestorCik, handleToggleExpandedInvestor, ticker]
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
        <CardTitle className="flex flex-wrap items-start justify-between gap-4 sm:items-center">
          <span className="min-w-0 flex-1 text-balance">{cardTitle}</span>
          <div className="flex min-w-0 w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
            <div
              data-testid="drilldown-table-telemetry-slot"
              className="flex min-h-8 min-w-0 max-w-full items-center justify-start sm:justify-end"
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
              getRowKey={(row) => row.cik}
              searchPlaceholder="Filter superinvestors..."
              defaultSortColumn="cikName"
              defaultSortDirection="asc"
              gridTemplateColumns="minmax(0, 1.4fr) minmax(5.5rem, 0.55fr) minmax(5.5rem, 0.6fr) minmax(5.5rem, 0.55fr) 3rem"
              mobileGridTemplateColumns="minmax(0, 1.2fr) minmax(4.25rem, 0.5fr) minmax(4.75rem, 0.55fr) minmax(4.75rem, 0.5fr) 2.25rem"
              latencySource="tsdb-memory"
              dataSource={dataFlow}
              expandedRowKey={expandedInvestorCik}
              expandedRowHeight={152}
              renderExpandedRow={(row) => (
                <SuperinvestorAssetHistorySection
                  ticker={ticker}
                  cusip={cusip}
                  investor={{
                    cik: row.cik,
                    cikName: row.cikName,
                    quarter: row.quarter,
                    action: row.action,
                  }}
                />
              )}
              onTableTelemetryChange={setTableTelemetry}
              tableTelemetryLabel="drilldown table"
              searchTelemetryLabel="search"
              searchStrategy="ufuzzy"
              ufuzzyRanking={{
                mode: "name-only",
                getName: (row) => row.cikName,
              }}
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
