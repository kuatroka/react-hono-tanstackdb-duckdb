import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Superinvestor } from "@/collections";
import { fetchSuperinvestorRecordWithSource } from "@/collections";
import { SuperinvestorChartSection } from "@/components/detail/SuperinvestorChartSection";
import { useMarkContentReady } from "@/hooks/useContentReady";

interface SuperinvestorDetailRecordState {
  cik: string | undefined;
  record: Superinvestor | null | undefined;
}

export function SuperinvestorDetailPage() {
  const { cik } = useParams({ strict: false }) as { cik?: string };
  const onReady = useMarkContentReady();
  const [recordState, setRecordState] = useState<SuperinvestorDetailRecordState>({
    cik: undefined,
    record: undefined,
  });
  const readyCalledRef = useRef(false);

  const isCurrentRecord = cik !== undefined && recordState.cik === cik;

  useEffect(() => {
    readyCalledRef.current = false;
  }, [cik]);

  useEffect(() => {
    if (!cik) return;

    let cancelled = false;
    setRecordState({
      cik,
      record: undefined,
    });

    void (async () => {
      let nextRecord: Superinvestor | null = null;

      try {
        const result = await fetchSuperinvestorRecordWithSource(cik);
        nextRecord = result.record;
      } catch (error) {
        if (!cancelled) {
          console.error("[SuperinvestorDetail] Failed to load superinvestor record:", error);
        }
      }

      if (!cancelled) {
        setRecordState({
          cik,
          record: nextRecord,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cik]);

  useEffect(() => {
    if (readyCalledRef.current) return;
    if (isCurrentRecord && recordState.record !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [isCurrentRecord, onReady, recordState.record]);

  if (!cik) return <div className="p-6">Missing CIK.</div>;

  if (!isCurrentRecord || recordState.record === undefined) {
    return <div className="p-6">Loading…</div>;
  }

  if (!recordState.record) {
    return <div className="p-6">Superinvestor not found.</div>;
  }

  const record = recordState.record;

  return (
    <>
      <div className="grid w-full grid-cols-3 items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-left">
          <Link
            to="/superinvestors"
            search={{ page: undefined, search: undefined }}
            className="whitespace-nowrap text-primary hover:underline"
          >
            &larr; Back to superinvestors
          </Link>
        </div>
        <div className="text-center">
          <h1 className="overflow-hidden text-ellipsis whitespace-nowrap text-3xl font-bold">
            ({record.cik}) {record.cikName}
          </h1>
        </div>
        <div className="text-right" />
      </div>

      <div className="mt-8 px-4 sm:px-6 lg:px-8">
        <SuperinvestorChartSection cik={record.cik} cikName={record.cikName} />
      </div>
    </>
  );
}
