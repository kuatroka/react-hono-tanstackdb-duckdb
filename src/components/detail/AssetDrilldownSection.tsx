import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { InvestorActivityDrilldownTable } from "@/components/InvestorActivityDrilldownTable";
import {
  fetchAssetActivityData,
  getAssetActivityFromCollection,
  type AssetActivityData,
} from "@/collections/asset-activity";
import {
  backgroundLoadAllDrilldownData,
  fetchDrilldownBothActions,
} from "@/collections/investor-details";
import { clearAssetDetailRouteCaches } from "@/collections/page-cache-cleanup";

type InvestorActivityAction = "open" | "close";

export interface InvestorActivitySelection {
  quarter: string;
  action: InvestorActivityAction;
}

interface AssetDrilldownSectionContextValue {
  setSelection: (next: InvestorActivitySelection) => void;
}

interface ActivityRowPreview {
  quarter: string;
  numOpen?: number | null;
  numClose?: number | null;
}

function getDefaultInvestorActivitySelection(rows: ActivityRowPreview[]): InvestorActivitySelection | null {
  if (rows.length === 0) return null;

  const latestQuarterData = rows[rows.length - 1];
  const latestQuarter = latestQuarterData?.quarter;
  if (!latestQuarter) return null;

  const hasOpenData = Boolean(latestQuarterData?.numOpen && latestQuarterData.numOpen > 0);
  const hasCloseData = Boolean(latestQuarterData?.numClose && latestQuarterData.numClose > 0);

  if (hasOpenData) {
    return { quarter: latestQuarter, action: "open" };
  }

  if (hasCloseData) {
    return { quarter: latestQuarter, action: "close" };
  }

  for (let index = rows.length - 2; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row?.quarter) continue;

    const hasOpen = Boolean(row.numOpen && row.numOpen > 0);
    const hasClose = Boolean(row.numClose && row.numClose > 0);

    if (hasOpen) {
      return { quarter: row.quarter, action: "open" };
    }

    if (hasClose) {
      return { quarter: row.quarter, action: "close" };
    }
  }

  return { quarter: latestQuarter, action: "open" };
}

const AssetDrilldownSectionContext = createContext<AssetDrilldownSectionContextValue | null>(null);

export function useAssetDrilldownSection() {
  const context = useContext(AssetDrilldownSectionContext);
  if (!context) {
    throw new Error("useAssetDrilldownSection must be used within AssetDrilldownSection");
  }
  return context;
}

interface AssetDrilldownSectionProps {
  code: string;
  ticker: string;
  cusip: string | null;
  hasCusip: boolean;
  children: ReactNode;
}

interface AssetDrilldownDetailsPanelProps {
  ticker: string;
  cusip: string | null;
  hasCusip: boolean;
  resolvedSelection: InvestorActivitySelection | null;
}

function areActivityRowsEqual(left: AssetActivityData[], right: AssetActivityData[]) {
  if (left.length !== right.length) return false;
  return left.every((row, index) => {
    const other = right[index];
    return other
      && row.id === other.id
      && row.quarter === other.quarter
      && row.numOpen === other.numOpen
      && row.numClose === other.numClose;
  });
}

function getSortedAssetActivityRows(code: string, cusip: string | null, hasCusip: boolean) {
  return [...getAssetActivityFromCollection(code, hasCusip ? cusip : null)].sort((left, right) =>
    left.quarter.localeCompare(right.quarter),
  );
}

function AssetDrilldownDetailsPanel({
  ticker,
  cusip,
  hasCusip,
  resolvedSelection,
}: AssetDrilldownDetailsPanelProps) {
  if (!hasCusip) {
    return (
      <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
        No CUSIP available for this asset.
      </div>
    );
  }

  if (!resolvedSelection || !cusip) {
    return (
      <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
        Click a bar in the chart to see details
      </div>
    );
  }

  return (
    <InvestorActivityDrilldownTable
      key={`click-${ticker}-${cusip}-${resolvedSelection.quarter}-${resolvedSelection.action}`}
      ticker={ticker}
      cusip={cusip}
      quarter={resolvedSelection.quarter}
      action={resolvedSelection.action}
    />
  );
}

export function AssetDrilldownSection({
  code,
  ticker,
  cusip,
  hasCusip,
  children,
}: AssetDrilldownSectionProps) {
  const [activityRows, setActivityRows] = useState<AssetActivityData[]>(() => {
    if (!code) return [];
    return getSortedAssetActivityRows(code, cusip, hasCusip);
  });
  const [selection, setSelection] = useState<InvestorActivitySelection | null>(null);
  const [backgroundLoadProgress, setBackgroundLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const scrollYRef = useRef<number | null>(null);
  const backgroundLoadStartedRef = useRef(false);
  const eagerSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code) {
      setActivityRows([]);
      return;
    }

    let cancelled = false;
    const fallbackRows = getSortedAssetActivityRows(code, cusip, hasCusip);
    setActivityRows((currentRows) => areActivityRowsEqual(currentRows, fallbackRows) ? currentRows : fallbackRows);

    void (async () => {
      try {
        const { rows } = await fetchAssetActivityData(code, hasCusip ? cusip : null);
        const resolvedRows = rows.length > 0
          ? rows
          : fallbackRows;
        if (!cancelled) {
          const sortedRows = [...resolvedRows].sort((left, right) => left.quarter.localeCompare(right.quarter));
          setActivityRows((currentRows) => areActivityRowsEqual(currentRows, sortedRows) ? currentRows : sortedRows);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[AssetDrilldownSection] Failed to load asset activity:", error);
          setActivityRows((currentRows) => areActivityRowsEqual(currentRows, fallbackRows) ? currentRows : fallbackRows);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, cusip, hasCusip]);

  const defaultSelection = useMemo(() => {
    if (selection || activityRows.length === 0 || !code || !hasCusip || !cusip) return null;
    return getDefaultInvestorActivitySelection(activityRows);
  }, [activityRows, code, cusip, hasCusip, selection]);

  const resolvedSelection = selection ?? defaultSelection;

  const handleSelectionChange = useCallback((next: InvestorActivitySelection) => {
    if (typeof window !== "undefined") {
      scrollYRef.current = window.scrollY;
    }
    setSelection(next);
  }, []);

  useEffect(() => {
    if (scrollYRef.current == null) return;
    const y = scrollYRef.current;
    scrollYRef.current = null;
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, left: 0, behavior: "auto" });
        });
      });
    }
  }, [selection]);

  useEffect(() => {
    backgroundLoadStartedRef.current = false;
    eagerSelectionKeyRef.current = null;
    setSelection(null);
    setBackgroundLoadProgress(null);
  }, [code, cusip, hasCusip]);

  useEffect(() => {
    return () => {
      clearAssetDetailRouteCaches();
    };
  }, []);

  useEffect(() => {
    if (!defaultSelection || !code || !hasCusip || !cusip) return;

    const selectionKey = `${code}:${cusip}:${defaultSelection.quarter}`;
    if (eagerSelectionKeyRef.current === selectionKey) {
      return;
    }
    eagerSelectionKeyRef.current = selectionKey;

    fetchDrilldownBothActions(code, cusip, defaultSelection.quarter).catch((error) => {
      console.error("[AssetDrilldownSection] Failed eager drilldown load:", error);
    });
  }, [defaultSelection, code, cusip, hasCusip]);

  useEffect(() => {
    if (!resolvedSelection || !code || !hasCusip || !cusip || backgroundLoadStartedRef.current || activityRows.length === 0) {
      return;
    }

    backgroundLoadStartedRef.current = true;
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      backgroundLoadAllDrilldownData(
        code,
        cusip,
        [],
        (loaded, total) => {
          if (cancelled) {
            return;
          }
          setBackgroundLoadProgress({ loaded, total });
        },
      ).catch((error) => {
        if (!cancelled) {
          console.error("[AssetDrilldownSection] Failed background drilldown load:", error);
        }
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [resolvedSelection, activityRows, code, cusip, hasCusip]);

  const contextValue = useMemo<AssetDrilldownSectionContextValue>(() => ({
    setSelection: handleSelectionChange,
  }), [handleSelectionChange]);

  return (
    <AssetDrilldownSectionContext.Provider value={contextValue}>
      <div className="space-y-4">
        {backgroundLoadProgress && backgroundLoadProgress.loaded < backgroundLoadProgress.total && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>
              Pre-loading drill-down data: {backgroundLoadProgress.loaded}/{backgroundLoadProgress.total}
              ({Math.round((backgroundLoadProgress.loaded / backgroundLoadProgress.total) * 100)}%)
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
          <div className="min-w-0 h-full [&>*]:h-full">{children}</div>

          <div className="min-w-0 h-full [&>*]:h-full">
            <AssetDrilldownDetailsPanel
              ticker={ticker}
              cusip={cusip}
              hasCusip={hasCusip}
              resolvedSelection={resolvedSelection}
            />
          </div>
        </div>
      </div>
    </AssetDrilldownSectionContext.Provider>
  );
}
