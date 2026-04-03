import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  setSelection: (next: InvestorActivitySelection) => void;
  setHoverSelection: (next: InvestorActivitySelection | null) => void;
}

interface HoverSelectionStore {
  getSnapshot: () => InvestorActivitySelection | null;
  subscribe: (listener: () => void) => () => void;
  set: (next: InvestorActivitySelection | null) => void;
}

type ActivityRowPreview = {
  quarter: string;
  numOpen?: number | null;
  numClose?: number | null;
};

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

  for (let i = rows.length - 2; i >= 0; i--) {
    const row = rows[i];
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

function createHoverSelectionStore(): HoverSelectionStore {
  let current: InvestorActivitySelection | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      if (
        current?.quarter === next?.quarter
        && current?.action === next?.action
      ) {
        return;
      }

      current = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

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

interface AssetDrilldownInteractionPanelsProps {
  ticker: string;
  cusip: string | null;
  hasCusip: boolean;
  resolvedSelection: InvestorActivitySelection | null;
  hoverSelectionStore: HoverSelectionStore;
}

function AssetDrilldownInteractionPanels({
  ticker,
  cusip,
  hasCusip,
  resolvedSelection,
  hoverSelectionStore,
}: AssetDrilldownInteractionPanelsProps) {
  const hoverSelection = useSyncExternalStore(
    hoverSelectionStore.subscribe,
    hoverSelectionStore.getSnapshot,
    hoverSelectionStore.getSnapshot,
  );

  if ((resolvedSelection || hoverSelection) && hasCusip && cusip) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Click Interaction
            </span>
            {resolvedSelection && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Locked
              </span>
            )}
          </div>
          {resolvedSelection ? (
            <InvestorActivityDrilldownTable
              key={`click-${ticker}-${cusip}-${resolvedSelection.quarter}-${resolvedSelection.action}`}
              ticker={ticker}
              cusip={cusip}
              quarter={resolvedSelection.quarter}
              action={resolvedSelection.action}
            />
          ) : (
            <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
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
            <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
              Hover over a bar in the chart to see details
            </div>
          )}
        </div>
      </div>
    );
  }

  if (resolvedSelection || hoverSelection) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No CUSIP available for this asset.
      </div>
    );
  }

  return (
    <div className="py-8 text-center text-muted-foreground">
      Click or hover over a bar in the chart to see which superinvestors opened or closed positions.
    </div>
  );
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
  const [backgroundLoadProgress, setBackgroundLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const scrollYRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundLoadStartedRef = useRef(false);
  const backgroundLoadGenerationRef = useRef(0);
  const hoverSelectionStore = useMemo(createHoverSelectionStore, []);

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

  const handleHoverChange = useCallback((next: InvestorActivitySelection | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (next) {
      hoverTimeoutRef.current = setTimeout(() => {
        hoverSelectionStore.set(next);
      }, 150);
      return;
    }

    hoverSelectionStore.set(null);
  }, [hoverSelectionStore]);

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
    return () => {
      clearAssetDetailRouteCaches();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      hoverSelectionStore.set(null);
    };
  }, [hoverSelectionStore]);

  useEffect(() => {
    if (!defaultSelection || !code || !hasCusip || !cusip) return;

    fetchDrilldownBothActions(code, cusip, defaultSelection.quarter).catch((error) => {
      console.error("[AssetDrilldownSection] Failed eager drilldown load:", error);
    });
  }, [defaultSelection, code, cusip, hasCusip]);

  useEffect(() => {
    if (!resolvedSelection || !code || !hasCusip || !cusip || backgroundLoadStartedRef.current || activityRows.length === 0) {
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
  }, [resolvedSelection, activityRows, code, cusip, hasCusip]);

  const contextValue = useMemo<AssetDrilldownSectionContextValue>(() => ({
    setSelection: handleSelectionChange,
    setHoverSelection: handleHoverChange,
  }), [handleHoverChange, handleSelectionChange]);

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

        <AssetDrilldownInteractionPanels
          ticker={ticker}
          cusip={cusip}
          hasCusip={hasCusip}
          resolvedSelection={resolvedSelection}
          hoverSelectionStore={hoverSelectionStore}
        />
      </div>
    </AssetDrilldownSectionContext.Provider>
  );
 }
