import { useEffect, useState } from "react";
import {
  fetchSuperinvestorAssetHistoryData,
  getSuperinvestorAssetHistoryFromCollection,
  type SuperinvestorAssetHistoryRow,
} from "@/collections/superinvestor-asset-history";
import { type DataFlow } from "@/components/LatencyBadge";

interface AssetHistoryLoadState {
  queryTimeMs: number | null;
  dataSource: DataFlow;
  isLoading: boolean;
}

function mapAssetHistoryDataSource(source: string): DataFlow {
  return source === "api"
    ? "api-duckdb"
    : source === "indexeddb"
      ? "tsdb-indexeddb"
      : "tsdb-memory";
}

function createInitialAssetHistoryState(ticker: string, cusip: string, cik: string): AssetHistoryLoadState {
  return {
    queryTimeMs: null,
    dataSource: "unknown",
    isLoading: Boolean(ticker && cusip && cik),
  };
}

export function useSuperinvestorAssetHistoryData(ticker: string, cusip: string, cik: string) {
  const [historyStatus, setHistoryStatus] = useState<AssetHistoryLoadState>(() =>
    createInitialAssetHistoryState(ticker, cusip, cik),
  );
  const [historyRows, setHistoryRows] = useState<SuperinvestorAssetHistoryRow[]>([]);

  useEffect(() => {
    if (!ticker || !cusip || !cik) {
      setHistoryRows([]);
      setHistoryStatus(createInitialAssetHistoryState(ticker, cusip, cik));
      return;
    }

    let cancelled = false;
    const cachedRows = getSuperinvestorAssetHistoryFromCollection(ticker, cusip, cik);
    const hasCachedRows = cachedRows.length > 0;

    setHistoryRows(cachedRows);
    setHistoryStatus({
      queryTimeMs: hasCachedRows ? 0 : null,
      dataSource: hasCachedRows ? "tsdb-memory" : "unknown",
      isLoading: !hasCachedRows,
    });

    void (async () => {
      try {
        const { rows, queryTimeMs, source } = await fetchSuperinvestorAssetHistoryData(ticker, cusip, cik);
        if (cancelled) return;
        const nextRows = rows.length > 0 ? rows : cachedRows;
        setHistoryRows(nextRows);
        setHistoryStatus({
          queryTimeMs,
          dataSource: mapAssetHistoryDataSource(source),
          isLoading: false,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("[useSuperinvestorAssetHistoryData] Failed to load investor asset history:", error);
          setHistoryStatus({
            queryTimeMs: null,
            dataSource: "unknown",
            isLoading: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cik, cusip, ticker]);

  return {
    rows: historyRows,
    queryTimeMs: historyStatus.queryTimeMs,
    dataSource: historyStatus.dataSource,
    isLoading: historyStatus.isLoading,
  };
}
