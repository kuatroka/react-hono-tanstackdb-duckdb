import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@rocicorp/zero/react';
import { LatencyBadge } from '@/components/LatencyBadge';
import { useLatencyMs } from '@/lib/latency';
import { queries } from '@/zero/queries';
import { PRELOAD_TTL } from '@/zero-preload';

export function SuperinvestorDetailPage({ onReady }: { onReady: () => void }) {
  const { cik } = useParams();

  const [rows, result] = useQuery(
    queries.superinvestorByCik(cik || ''),
    { enabled: Boolean(cik), ttl: PRELOAD_TTL }
  );

  const record = rows?.[0];

  const detailReady = Boolean(record || result.type === 'complete');
  const detailLatencyMs = useLatencyMs({
    isReady: detailReady,
    resetKey: `superinvestor:${cik ?? ''}`,
    enabled: Boolean(cik),
  });

  // Signal ready when data is available (from cache or server)
  useEffect(() => {
    if (record || result.type === 'complete') {
      onReady();
    }
  }, [record, result.type, onReady]);

  if (!cik) return <div className="p-6">Missing CIK.</div>;

  if (record) {
    // We have data, render it immediately (even if still syncing)
  } else if (result.type === 'unknown') {
    // Still loading and no cached data yet
    return <div className="p-6">Loading…</div>;
  } else {
    // Query completed but no record found
    return <div className="p-6">Superinvestor not found.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{record.cikName}</h1>
          <LatencyBadge ms={detailLatencyMs} source="Zero: superinvestors.byCik" />
        </div>
      </div>
      <div className="space-y-3 text-lg">
        <div><span className="font-semibold">CIK:</span> {record.cik}</div>
        <div><span className="font-semibold">Ticker:</span> {record.cikTicker ?? '—'}</div>
        <div><span className="font-semibold">Active Periods:</span> {record.activePeriods ?? '—'}</div>
        <div><span className="font-semibold">ID:</span> {record.id}</div>
      </div>
      <div className="mt-6">
        <Link to="/superinvestors" className="link link-primary">Back to superinvestors</Link>
      </div>
    </div>
  );
}
