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
import { useLiveQuery } from "@tanstack/react-db";
import { InvestorActivityDrilldownTable } from "@/components/InvestorActivityDrilldownTable";
import { assetActivityCollection } from "@/collections";
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
  selection: InvestorActivitySelection | null;
  hoverSelection: InvestorActivitySelection | null;
  setSelection: (next: InvestorActivitySelection) => void;
  setHoverSelection: (next: InvestorActivitySelection | null) => void;
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

export function AssetDrilldownSection({
  code,
  ticker,
  cusip,
  hasCusip,
  children,
}: AssetDrilldownSectionProps) {
  const { data: activityCollectionData } = useLiveQuery((q) => q.from({ rows: assetActivityCollection }));
  const [selection, setSelection] = useState<InvestorActivitySelection | null>(null);
  const [hoverSelection, setHoverSelectionState] = useState<InvestorActivitySelection | null>(null);
  const [backgroundLoadProgress, setBackgroundLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const scrollYRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundLoadStartedRef = useRef(false);
  const backgroundLoadGenerationRef = useRef(0);

  const activityRows = useMemo(() => {
    if (!activityCollectionData) return [];
    return activityCollectionData
      .filter((row) => (
        hasCusip
          ? row.ticker === code && row.cusip === cusip
          : row.ticker === code
      ))
      .sort((left, right) => left.quarter.localeCompare(right.quarter));
  }, [activityCollectionData, code, cusip, hasCusip]);

  const handleSelectionChange = useCallback((next: InvestorActivitySelection) => {
    if (typeof window !== "undefined") {
      scrollYRef.current = window.scrollY;
    }
    setSelection(next);
  }, []);

  const handleHoverChange = useCallback((next: InvestorActivitySelection | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (next) {
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverSelectionState(next);
      }, 150);
      return;
    }

    setHoverSelectionState(null);
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
    backgroundLoadGenerationRef.current += 1;
    setSelection(null);
    setHoverSelectionState(null);
    setBackgroundLoadProgress(null);
    backgroundLoadStartedRef.current = false;
  }, [code, cusip]);

  useEffect(() => {
    return () => {
      clearAssetDetailRouteCaches();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selection || activityRows.length === 0 || !code || !hasCusip || !cusip) return;

    const latestQuarter = activityRows[activityRows.length - 1]?.quarter;
    if (!latestQuarter) return;

    const latestQuarterData = activityRows[activityRows.length - 1];
    const hasOpenData = Boolean(latestQuarterData?.numOpen && latestQuarterData.numOpen > 0);
    const hasCloseData = Boolean(latestQuarterData?.numClose && latestQuarterData.numClose > 0);

    if (hasOpenData) {
      setSelection({ quarter: latestQuarter, action: "open" });
    } else if (hasCloseData) {
      setSelection({ quarter: latestQuarter, action: "close" });
    } else {
      for (let i = activityRows.length - 2; i >= 0; i--) {
        const row = activityRows[i];
        if (!row?.quarter) continue;

        const hasOpen = Boolean(row.numOpen && row.numOpen > 0);
        const hasClose = Boolean(row.numClose && row.numClose > 0);

        if (hasOpen) {
          setSelection({ quarter: row.quarter, action: "open" });
          return;
        }

        if (hasClose) {
          setSelection({ quarter: row.quarter, action: "close" });
          return;
        }
      }

      setSelection({ quarter: latestQuarter, action: "open" });
    }

    fetchDrilldownBothActions(code, cusip, latestQuarter).catch((error) => {
      console.error("[AssetDrilldownSection] Failed eager drilldown load:", error);
    });
  }, [selection, activityRows, code, cusip, hasCusip]);

  useEffect(() => {
    if (!selection || !code || !hasCusip || !cusip || backgroundLoadStartedRef.current || activityRows.length === 0) {
      return;
    }

    backgroundLoadStartedRef.current = true;
    const generation = backgroundLoadGenerationRef.current;
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      backgroundLoadAllDrilldownData(
        code,
        cusip,
        [],
        (loaded, total) => {
          if (cancelled || backgroundLoadGenerationRef.current !== generation) {
            return;
          }
          setBackgroundLoadProgress({ loaded, total });
        },
      ).catch((error) => {
        if (!cancelled && backgroundLoadGenerationRef.current === generation) {
          console.error("[AssetDrilldownSection] Failed background drilldown load:", error);
        }
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [selection, activityRows, code, cusip, hasCusip]);

  const contextValue = useMemo<AssetDrilldownSectionContextValue>(() => ({
    selection,
    hoverSelection,
    setSelection: handleSelectionChange,
    setHoverSelection: handleHoverChange,
  }), [handleHoverChange, handleSelectionChange, hoverSelection, selection]);

  return (
    <AssetDrilldownSectionContext.Provider value={contextValue}>
      {children}

      <div className="mt-8 min-h-[200px]">
        {backgroundLoadProgress && backgroundLoadProgress.loaded < backgroundLoadProgress.total && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>
              Pre-loading drill-down data: {backgroundLoadProgress.loaded}/{backgroundLoadProgress.total}
              ({Math.round((backgroundLoadProgress.loaded / backgroundLoadProgress.total) * 100)}%)
            </span>
          </div>
        )}

        {backgroundLoadProgress && backgroundLoadProgress.loaded === backgroundLoadProgress.total && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-600">
            <span>✓ All drill-down data loaded - clicks are now instant!</span>
          </div>
        )}

        {(selection || hoverSelection) && hasCusip && cusip ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Click Interaction
                </span>
                {selection && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Locked
                  </span>
                )}
              </div>
              {selection ? (
                <InvestorActivityDrilldownTable
                  key={`click-${ticker}-${cusip}-${selection.quarter}-${selection.action}`}
                  ticker={ticker}
                  cusip={cusip}
                  quarter={selection.quarter}
                  action={selection.action}
                />
              ) : (
                <div className="rounded-lg border bg-card py-8 text-center text-muted-foreground">
                  Click a bar in the chart to see details
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Hover Interaction
              </div>
              {hoverSelection ? (
                <InvestorActivityDrilldownTable
                  ticker={ticker}
                  cusip={cusip}
                  quarter={hoverSelection.quarter}
                  action={hoverSelection.action}
                />
              ) : (
                <div className="rounded-lg border bg-card py-8 text-center text-muted-foreground">
                  Hover over a bar in the chart to see details
                </div>
              )}
            </div>
          </div>
        ) : (selection || hoverSelection) ? (
          <div className="py-8 text-center text-muted-foreground">
            No CUSIP available for this asset.
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Click or hover over a bar in the chart to see which superinvestors opened or closed positions.
          </div>
        )}
      </div>
    </AssetDrilldownSectionContext.Provider>
  );
}
