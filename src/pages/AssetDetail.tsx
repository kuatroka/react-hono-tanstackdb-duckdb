import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/collections";
import { fetchAssetRecord } from "@/collections";
import { AssetActivitySection } from "@/components/detail/AssetActivitySection";
import { AssetDrilldownSection } from "@/components/detail/AssetDrilldownSection";
import { AssetFlowSection } from "@/components/detail/AssetFlowSection";
import { useContentReady } from "@/hooks/useContentReady";

export function AssetDetailPage() {
  const { code, cusip } = useParams({ strict: false }) as { code?: string; cusip?: string };
  const { onReady } = useContentReady();
  const hasCusip = Boolean(cusip && cusip !== "_");
  const [record, setRecord] = useState<Asset | null | undefined>(undefined);
  const readyCalledRef = useRef(false);

  useEffect(() => {
    if (!code) {
      setRecord(undefined);
      return;
    }

    let cancelled = false;
    setRecord(undefined);

    fetchAssetRecord(code, hasCusip ? cusip : null)
      .then((assetRecord) => {
        if (!cancelled) {
          setRecord(assetRecord);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[AssetDetail] Failed to load asset record:", error);
          setRecord(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, cusip, hasCusip]);

  useEffect(() => {
    readyCalledRef.current = false;
  }, [code, cusip]);

  useEffect(() => {
    if (readyCalledRef.current) return;
    if (record !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [record, onReady]);

  if (!code) return <div className="p-6">Missing asset code.</div>;

  if (record === undefined) {
    return <div className="p-6">Loading…</div>;
  }

  if (!record) {
    return <div className="p-6">Asset not found.</div>;
  }

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
