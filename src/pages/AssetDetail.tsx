import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/collections/assets";
import { fetchAssetRecord } from "@/collections/assets";
import { AssetActivitySection } from "@/components/detail/AssetActivitySection";
import { AssetDrilldownSection } from "@/components/detail/AssetDrilldownSection";
import { AssetFlowSection } from "@/components/detail/AssetFlowSection";
import { PageHeader, PageLayout, PageSection } from "@/components/layout/page-layout";
import { useMarkContentReady } from "@/hooks/useContentReady";

interface AssetDetailRecordState {
  code: string | undefined;
  cusip: string | null | undefined;
  record: Asset | null | undefined;
}

export function AssetDetailPage() {
  const { code, cusip } = useParams({ strict: false }) as { code?: string; cusip?: string };
  const onReady = useMarkContentReady();
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
    <PageLayout width="full" className="space-y-8">
      <PageHeader
        leading={
          <Link
            to="/assets"
            search={{ page: undefined, search: undefined }}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <span aria-hidden="true">←</span>
            <span>Back to assets</span>
          </Link>
        }
        title={`(${record.asset}) ${record.assetName}`}
      />

      <PageSection>
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
        </AssetDrilldownSection>
      </PageSection>

      <PageSection>
        <AssetFlowSection
          code={code}
          ticker={record.asset}
        />
      </PageSection>
    </PageLayout>
  );
}
