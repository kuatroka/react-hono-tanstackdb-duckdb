import { useParams, Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';

import { InvestorActivityUplotChart } from '@/components/charts/InvestorActivityUplotChart';
import { InvestorActivityEchartsChart } from '@/components/charts/InvestorActivityEchartsChart';
import { InvestorFlowChart } from '@/components/charts/InvestorFlowChart';
import { InvestorActivityDrilldownTable } from '@/components/InvestorActivityDrilldownTable';
import { LatencyBadge, type DataFlow } from '@/components/LatencyBadge';
import { useContentReady } from '@/hooks/useContentReady';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assetsCollection,
  assetActivityCollection,
  investorFlowCollection,
  fetchAssetActivityData,
  fetchInvestorFlowData,
} from '@/collections';
import { backgroundLoadAllDrilldownData, fetchDrilldownBothActions } from '@/collections/investor-details';

type InvestorActivityAction = 'open' | 'close';

interface InvestorActivitySelection {
  quarter: string;
  action: InvestorActivityAction;
}

export function AssetDetailPage() {
  const { code, cusip } = useParams({ strict: false }) as { code?: string; cusip?: string };
  const { onReady } = useContentReady();

  // Determine if we have a valid cusip (not "_" placeholder)
  const hasCusip = cusip && cusip !== "_";

  // Query assets from TanStack DB local collection (instant)
  // Data is preloaded on app init
  const { data: assetsData, isLoading: isAssetsLoading } = useLiveQuery(
    (q) => q.from({ assets: assetsCollection }),
  );

  // Find the specific asset record
  const record = assetsData?.find(a =>
    hasCusip
      ? a.asset === code && a.cusip === cusip
      : a.asset === code
  );

  // Signal ready immediately when asset record is available
  const readyCalledRef = useRef(false);
  useEffect(() => {
    if (readyCalledRef.current) return;
    if (record || (!isAssetsLoading && assetsData !== undefined)) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [record, isAssetsLoading, assetsData, onReady]);

  const [activityQueryTimeMs, setActivityQueryTimeMs] = useState<number | null>(null);
  const [activityDataSource, setActivityDataSource] = useState<DataFlow>('unknown');
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const { data: activityCollectionData } = useLiveQuery(
    (q) => q.from({ rows: assetActivityCollection }),
  );

  // Query investor flow for this asset
  const [flowQueryTimeMs, setFlowQueryTimeMs] = useState<number | null>(null);
  const [flowDataSource, setFlowDataSource] = useState<DataFlow>('unknown');
  const [isFlowLoading, setIsFlowLoading] = useState(false);
  const { data: flowCollectionData } = useLiveQuery(
    (q) => q.from({ rows: investorFlowCollection }),
  );

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    setIsActivityLoading(true);

    fetchAssetActivityData(code, hasCusip ? cusip : null)
      .then(({ queryTimeMs, source }) => {
        if (cancelled) return;
        setActivityQueryTimeMs(queryTimeMs);
        setActivityDataSource(
          source === 'api' ? 'tsdb-api' : source === 'indexeddb' ? 'tsdb-indexeddb' : 'tsdb-memory',
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[AssetDetail] Failed to load asset activity:', error);
        setActivityQueryTimeMs(null);
        setActivityDataSource('unknown');
      })
      .finally(() => {
        if (!cancelled) {
          setIsActivityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, cusip, hasCusip]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    setIsFlowLoading(true);

    fetchInvestorFlowData(code)
      .then(({ queryTimeMs, source }) => {
        if (cancelled) return;
        setFlowQueryTimeMs(queryTimeMs);
        setFlowDataSource(
          source === 'api' ? 'tsdb-api' : source === 'indexeddb' ? 'tsdb-indexeddb' : 'tsdb-memory',
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[AssetDetail] Failed to load investor flow:', error);
        setFlowQueryTimeMs(null);
        setFlowDataSource('unknown');
      })
      .finally(() => {
        if (!cancelled) {
          setIsFlowLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

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

  const flowRows = useMemo(() => {
    if (!flowCollectionData || !code) return [];
    const normalizedCode = code.trim().toUpperCase();
    return flowCollectionData
      .filter((row) => row.ticker === normalizedCode)
      .sort((left, right) => left.quarter.localeCompare(right.quarter));
  }, [flowCollectionData, code]);

  const [selection, setSelection] = useState<InvestorActivitySelection | null>(null);
  const [hoverSelection, setHoverSelection] = useState<InvestorActivitySelection | null>(null);
  const scrollYRef = useRef<number | null>(null);
  const [backgroundLoadProgress, setBackgroundLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const backgroundLoadStartedRef = useRef(false);

  const handleSelectionChange = useCallback((next: InvestorActivitySelection) => {
    if (typeof window !== 'undefined') {
      scrollYRef.current = window.scrollY;
    }
    setSelection(next);
  }, []);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleHoverChange = useCallback((next: InvestorActivitySelection | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (next) {
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverSelection(next);
      }, 150);
    } else {
      setHoverSelection(null);
    }
  }, []);

  useEffect(() => {
    if (scrollYRef.current == null) return;
    const y = scrollYRef.current;
    scrollYRef.current = null;
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        });
      });
    }
  }, [selection]);

  // Reset selection and background load flag when ticker changes
  useEffect(() => {
    setSelection(null);
    setHoverSelection(null);
    backgroundLoadStartedRef.current = false;
  }, [code]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Set initial selection to latest quarter immediately when activity data loads.
  // Try 'open' first, fall back to 'close' if no open data exists.
  useEffect(() => {
    if (selection || activityRows.length === 0 || !code) return;
    
    const latestQuarter = activityRows[activityRows.length - 1]?.quarter;
    if (!latestQuarter) return;
    
    // Check if latest quarter has open data
    const latestQuarterData = activityRows[activityRows.length - 1];
    const hasOpenData = latestQuarterData?.numOpen && latestQuarterData.numOpen > 0;
    const hasCloseData = latestQuarterData?.numClose && latestQuarterData.numClose > 0;
    
    if (hasOpenData) {
      console.log(`[Initial Selection] Setting to ${latestQuarter} open`);
      setSelection({ quarter: latestQuarter, action: 'open' });
    } else if (hasCloseData) {
      console.log(`[Initial Selection] No open data for ${latestQuarter}, falling back to close`);
      setSelection({ quarter: latestQuarter, action: 'close' });
    } else {
      // No data in latest quarter, try previous quarters
      for (let i = activityRows.length - 2; i >= 0; i--) {
        const row = activityRows[i];
        if (!row) continue;
        
        const quarter = row.quarter;
        if (!quarter) continue;
        
        const hasOpen = row.numOpen && row.numOpen > 0;
        const hasClose = row.numClose && row.numClose > 0;
        
        if (hasOpen) {
          console.log(`[Initial Selection] No data in latest quarter, setting to ${quarter} open`);
          setSelection({ quarter, action: 'open' });
          return;
        } else if (hasClose) {
          console.log(`[Initial Selection] No open data found, setting to ${quarter} close`);
          setSelection({ quarter, action: 'close' });
          return;
        }
      }
      
      // Fallback: just use latest quarter with open (table will show no data)
      console.log(`[Initial Selection] No data found in any quarter, defaulting to ${latestQuarter} open`);
      setSelection({ quarter: latestQuarter, action: 'open' });
    }
    
    // Eagerly load BOTH actions for the latest quarter to make clicks instant
    if (latestQuarter && code && record?.cusip) {
      const cusipValue = record.cusip;
      if (!cusipValue) return;
      const eagerStart = performance.now();
      console.log(`[Eager Load] Fetching both open and close for ${latestQuarter} in single call`);
      fetchDrilldownBothActions(code, cusipValue, latestQuarter)
        .then(({ rows, queryTimeMs }) => {
          const eagerWallMs = Math.round(performance.now() - eagerStart);
          console.log(`[Eager Load] Both actions loaded for ${latestQuarter}: wall=${eagerWallMs}ms, net=${queryTimeMs}ms, rows=${rows.length}`);
        })
        .catch(err => {
          console.error('[Eager Load] Failed:', err);
        });
    }
  }, [selection, activityRows, code, record?.cusip]);

  // Start background loading AFTER initial selection is set
  // Wait a bit to let the table fetch its data first, then load remaining quarters
  useEffect(() => {
    if (!selection || !code || !record?.cusip || backgroundLoadStartedRef.current || activityRows.length === 0) return;

    const cusipValue = record.cusip;
    if (!cusipValue) return;
    
    backgroundLoadStartedRef.current = true;
    
    // Delay background loading to let the table fetch its data first
    const timeoutId = setTimeout(() => {
      const bgStart = performance.now();
      console.log(`[Background Load] Starting bulk fetch for ${code}/${cusipValue}`);

      backgroundLoadAllDrilldownData(
        code,
        cusipValue,
        [], // empty list triggers full bulk load (route capped to 5000 rows)
        (loaded, total) => {
          setBackgroundLoadProgress({ loaded, total });
          if (loaded === total) {
            const bgMs = Math.round(performance.now() - bgStart);
            console.log(`[Background Load] Complete for ${code}/${cusipValue}: bulk fetch done in ${bgMs}ms`);
          }
        }
      ).catch(err => {
        console.error('[Background Load] Failed:', err);
      });
    }, 500); // 500ms delay to let table fetch first
    
    return () => clearTimeout(timeoutId);
  }, [selection, code, record?.cusip, activityRows]);

  if (!code) return <div className="p-6">Missing asset code.</div>;

  // Show loading while assets are loading or while IndexedDB-backed collection hydrates
  if (isAssetsLoading || (assetsData?.length === 0)) {
    return <div className="p-6">Loading…</div>;
  }

  if (!record) {
    return <div className="p-6">Asset not found.</div>;
  }

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-3 items-center">
        <div className="text-left">
          <Link
            to="/assets"
            search={{ page: undefined, search: undefined }}
            className="text-primary hover:underline whitespace-nowrap"
          >
            &larr; Back to assets
          </Link>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold whitespace-nowrap overflow-hidden text-ellipsis">({record.asset}) {record.assetName}</h1>
        </div>
        <div className="text-right" />
      </div>

      {/* Chart + drilldown section */}
      <div className="mt-8 px-4 sm:px-6 lg:px-8">
        {isActivityLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading investor activity charts...
          </div>
        ) : activityRows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No investor activity data available for this asset.
          </div>
        ) : (
          <>
            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InvestorActivityUplotChart
                data={activityRows}
                ticker={record.asset}
                onBarClick={({ quarter, action }) => handleSelectionChange({ quarter, action })}
                onBarHover={({ quarter, action }) => handleHoverChange({ quarter, action })}
                onBarLeave={() => handleHoverChange(null)}
                latencyBadge={
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">data</span>
                    <LatencyBadge latencyMs={activityQueryTimeMs ?? undefined} source={activityDataSource} />
                  </div>
                }
              />
              <InvestorActivityEchartsChart
                data={activityRows}
                ticker={record.asset}
                onBarClick={({ quarter, action }) => handleSelectionChange({ quarter, action })}
                onBarHover={({ quarter, action }) => handleHoverChange({ quarter, action })}
                onBarLeave={() => handleHoverChange(null)}
                latencyBadge={
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">data</span>
                    <LatencyBadge latencyMs={activityQueryTimeMs ?? undefined} source={activityDataSource} />
                  </div>
                }
              />
            </div>

            {/* Investor Flow Chart */}
            <div className="mt-6">
              {isFlowLoading ? (
                <div className="h-[400px] flex items-center justify-center border rounded-lg bg-card text-muted-foreground">
                  Loading flow chart...
                </div>
              ) : (
                <InvestorFlowChart
                  data={flowRows}
                  ticker={record.asset}
                  latencyBadge={<LatencyBadge latencyMs={flowQueryTimeMs ?? undefined} source={flowDataSource} />}
                />
              )}
            </div>

            <div className="mt-8 min-h-[200px]">
              {/* Background loading progress indicator */}
              {backgroundLoadProgress && backgroundLoadProgress.loaded < backgroundLoadProgress.total && (
                <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span>
                    Pre-loading drill-down data: {backgroundLoadProgress.loaded}/{backgroundLoadProgress.total} 
                    ({Math.round((backgroundLoadProgress.loaded / backgroundLoadProgress.total) * 100)}%)
                  </span>
                </div>
              )}
              {backgroundLoadProgress && backgroundLoadProgress.loaded === backgroundLoadProgress.total && (
                <div className="mb-4 text-sm text-green-600 flex items-center gap-2">
                  <span>✓ All drill-down data loaded - clicks are now instant!</span>
                </div>
              )}
              
              {/* Two tables side by side: Click-based (left) and Hover-based (right) */}
              {(selection || hoverSelection) && record.cusip ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Click-based table */}
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Click Interaction
                      </span>
                      {selection && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Locked
                        </span>
                      )}
                    </div>
                    {selection ? (
                      <InvestorActivityDrilldownTable
                        key={`click-${record.asset}-${record.cusip}-${selection.quarter}-${selection.action}`}
                        ticker={record.asset}
                        cusip={record.cusip}
                        quarter={selection.quarter}
                        action={selection.action}
                      />
                    ) : (
                      <div className="py-8 text-center text-muted-foreground border rounded-lg bg-card">
                        Click a bar in the chart to see details
                      </div>
                    )}
                  </div>
                  
                  {/* Hover-based table */}
                  <div>
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                      Hover Interaction
                    </div>
                    {hoverSelection ? (
                      <InvestorActivityDrilldownTable
                        ticker={record.asset}
                        cusip={record.cusip}
                        quarter={hoverSelection.quarter}
                        action={hoverSelection.action}
                      />
                    ) : (
                      <div className="py-8 text-center text-muted-foreground border rounded-lg bg-card">
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
          </>
        )}
      </div>
    </>
  );
}
