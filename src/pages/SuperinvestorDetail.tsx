import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Superinvestor } from "@/collections";
import { fetchSuperinvestorRecordWithSource } from "@/collections";
import { SuperinvestorChartSection } from "@/components/detail/SuperinvestorChartSection";
import { PageHeader, PageLayout, PageSection } from "@/components/layout/page-layout";
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
    <PageLayout width="full" className="space-y-8">
      <PageHeader
        leading={
          <Link
            to="/superinvestors"
            search={{ page: undefined, search: undefined }}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <span aria-hidden="true">←</span>
            <span>Back to superinvestors</span>
          </Link>
        }
        title={`(${record.cik}) ${record.cikName}`}
      />

      <PageSection>
        <SuperinvestorChartSection cik={record.cik} cikName={record.cikName} />
      </PageSection>
    </PageLayout>
  );
}
