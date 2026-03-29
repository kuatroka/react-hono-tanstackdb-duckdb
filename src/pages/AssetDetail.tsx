import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@rocicorp/zero/react';
import { LatencyBadge } from '@/components/LatencyBadge';
import { useLatencyMs } from '@/lib/latency';
import { queries } from '@/zero/queries';
import { PRELOAD_TTL } from '@/zero-preload';

export function AssetDetailPage({ onReady }: { onReady: () => void }) {
  const { code, cusip } = useParams();

  // Determine if we have a valid cusip (not "_" placeholder)
  const hasCusip = cusip && cusip !== "_";

  // Query asset: prefer by symbol+cusip if cusip is available, otherwise by symbol only
  const [rowsBySymbolAndCusip, resultBySymbolAndCusip] = useQuery(
    queries.assetBySymbolAndCusip(code || '', cusip || ''),
    { enabled: Boolean(code) && Boolean(hasCusip), ttl: PRELOAD_TTL }
  );

  const [rowsBySymbol, resultBySymbol] = useQuery(
    queries.assetBySymbol(code || ''),
    { enabled: Boolean(code) && !hasCusip, ttl: PRELOAD_TTL }
  );

  // Use the appropriate result based on whether we have a cusip
  const rows = hasCusip ? rowsBySymbolAndCusip : rowsBySymbol;
  const result = hasCusip ? resultBySymbolAndCusip : resultBySymbol;
  const record = rows?.[0];

  const assetReady = Boolean(record || result.type === 'complete');
  const assetLatencyMs = useLatencyMs({
    isReady: assetReady,
    resetKey: hasCusip ? `asset:${code ?? ''}:${cusip ?? ''}` : `asset:${code ?? ''}`,
  });
  const assetSource = hasCusip ? 'Zero: assets.bySymbolAndCusip' : 'Zero: assets.bySymbol';

  // Signal ready when data is available (from cache or server)
  useEffect(() => {
    if (record || result.type === 'complete') {
      onReady();
    }
  }, [record, result.type, onReady]);

  if (!code) return <div className="p-6">Missing asset code.</div>;

  if (record) {
    // We have data, render it immediately (even if still syncing)
  } else if (result.type === 'unknown') {
    // Still loading and no cached data yet
    return <div className="p-6">Loading…</div>;
  } else {
    // Query completed but no record found
    return <div className="p-6">Asset not found.</div>;
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">{record.assetName}</h1>
            <LatencyBadge ms={assetLatencyMs} source={assetSource} />
          </div>
        </div>
        <div className="space-y-3 text-lg">
          <div><span className="font-semibold">Symbol:</span> {record.asset}</div>
          {record.cusip && <div><span className="font-semibold">CUSIP:</span> {record.cusip}</div>}
          <div><span className="font-semibold">ID:</span> {record.id}</div>
        </div>

        <div className="mt-6">
          <Link
            to="/assets"
            className="text-primary underline-offset-4 hover:underline"
          >
            Back to assets
          </Link>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-8">
        <div className="mt-8">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Investor activity</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Investor activity charts are temporarily unavailable in this production deployment.
              The upstream dataset is present, but it is not yet Zero-syncable because the
              backing table is missing a stable client-sync key.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
