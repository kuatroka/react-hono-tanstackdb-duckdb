import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/collections";
import { fetchAssetRecord } from "@/collections";
import { AssetActivitySection } from "@/components/detail/AssetActivitySection";
import { AssetDrilldownSection } from "@/components/detail/AssetDrilldownSection";
import { AssetFlowSection } from "@/components/detail/AssetFlowSection";
import { useContentReady } from "@/hooks/useContentReady";

interface AssetDetailRecordState {
  code: string | undefined;
  cusip: string | null | undefined;
  record: Asset | null | undefined;
}

export function AssetDetailPage() {
  const { code, cusip } = useParams({ strict: false }) as { code?: string; cusip?: string };
  const { onReady } = useContentReady();
  const hasCusip = Boolean(cusip && cusip !== "_");
  const currentCusip = hasCusip ? cusip : null;
  const [recordState, setRecordState] = useState<AssetDetailRecordState>({
    code: undefined,
    cusip: undefined,
    record: undefined,
  });
  const readyCalledRef = useRef(false);

  const isCurrentRecord = code !== undefined && recordState.code === code && recordState.cusip === currentCusip;

  useEffect(() => {
    readyCalledRef.current = false;
  }, [code, currentCusip]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    void (async () => {
      let nextRecord: Asset | null = null;

      try {
        nextRecord = await fetchAssetRecord(code, currentCusip);
      } catch (error) {
        if (!cancelled) {
          console.error("[AssetDetail] Failed to load asset record:", error);
        }
      }

      if (!cancelled) {
        setRecordState({
          code,
          cusip: currentCusip,
          record: nextRecord,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, currentCusip]);

  useEffect(() => {
    if (readyCalledRef.current) return;
    if (isCurrentRecord && recordState.record !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [isCurrentRecord, onReady, recordState.record]);

  if (!code) return <div className="p-6">Missing asset code.</div>;

  if (!isCurrentRecord || recordState.record === undefined) {
    return <div className="p-6">Loading…</div>;
  }

  if (!recordState.record) {
    return <div className="p-6">Asset not found.</div>;
  }

  const record = recordState.record;

  return (
    <>
      <div className="grid w-full grid-cols-3 items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-left">
          <Link
            to="/assets"
            search={{ page: undefined, search: undefined }}
            className="whitespace-nowrap text-primary hover:underline"
          >
            &larr; Back to assets
          </Link>
        </div>
        <div className="text-center">
          <h1 className="overflow-hidden text-ellipsis whitespace-nowrap text-3xl font-bold">
            ({record.asset}) {record.assetName}
          </h1>
        </div>
        <div className="text-right" />
      </div>

      <div className="mt-8 px-4 sm:px-6 lg:px-8">
        <AssetDrilldownSection
          key={`asset-drilldown-${code}-${record.cusip ?? "no-cusip"}-${hasCusip ? "with-cusip" : "without-cusip"}`}
          code={code}
          ticker={record.asset}
          cusip={record.cusip}
          hasCusip={hasCusip}
        >
          <AssetActivitySection
            code={code}
            ticker={record.asset}
            cusip={record.cusip}
            hasCusip={hasCusip}
          />
          <AssetFlowSection code={code} ticker={record.asset} />
        </AssetDrilldownSection>
      </div>
    </>
  );
}
