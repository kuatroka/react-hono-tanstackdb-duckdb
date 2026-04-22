import { memo, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  VirtualDataTable,
  type ColumnDef,
} from "@/components/VirtualDataTable";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LatencyBadge } from "@/components/LatencyBadge";
import { PageLayout } from "@/components/layout/page-layout";
import { useMarkContentReady } from "@/hooks/useContentReady";
import type { PerfSource, PerfTelemetry } from "@/lib/perf/telemetry";
import {
  getSuperinvestorListLoadSource,
  subscribeSuperinvestorListLoadSource,
  superinvestorsCollection,
  type Superinvestor,
} from "@/collections/superinvestors";
export function SuperinvestorsTablePage() {
  return <SuperinvestorsTableSurface />;
}

const superinvestorTableColumns: ColumnDef<Superinvestor>[] = [
  {
    key: "cik",
    header: "CIK",
    sortable: true,
    searchable: true,
    clickable: true,
    render: (value, row, isFocused) => (
      <Link
        to="/superinvestors/$cik"
        params={{ cik: row.cik }}
        preload={false}
        className={`hover:underline underline-offset-4 cursor-pointer text-foreground outline-none ${isFocused ? "underline" : ""}`}
      >
        {String(value)}
      </Link>
    ),
  },
  {
    key: "cikName",
    header: "Name",
    sortable: true,
    searchable: true,
  },
];

const SuperinvestorsTableCard = memo(function SuperinvestorsTableCard({
  dataSource,
  rows,
}: {
  dataSource: PerfSource;
  rows: Superinvestor[];
}) {
  const [tableTelemetry, setTableTelemetry] = useState<PerfTelemetry | null>(
    null,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Superinvestors
          </CardTitle>
        </div>
        <div className="flex flex-col items-end gap-2">
          {tableTelemetry ? (
            <LatencyBadge
              telemetry={tableTelemetry}
              className="min-w-[11rem] justify-end"
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <VirtualDataTable
          data={rows}
          columns={superinvestorTableColumns}
          defaultSortColumn="cikName"
          gridTemplateColumns="minmax(12rem, 1fr) minmax(22rem, 1.6fr)"
          latencySource="tsdb-memory"
          dataSource={dataSource}
          onTableTelemetryChange={setTableTelemetry}
          clientPageSize={100}
          searchDebounceMs={150}
          searchPlaceholder="Search superinvestors..."
          searchStrategy="ufuzzy"
          ufuzzyRanking={{
            mode: "name-only",
            getName: (row) => row.cikName,
          }}
          searchTelemetryLabel="search"
          tableTelemetryLabel="virtual table"
        />
      </CardContent>
    </Card>
  );
});

function SuperinvestorsTableSurface() {
  const onReady = useMarkContentReady();
  const [superinvestorsData, setSuperinvestorsData] = useState<Superinvestor[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<PerfSource>(() => {
    const source = getSuperinvestorListLoadSource();
    return source === "api"
      ? "api-duckdb"
      : source === "indexeddb"
        ? "tsdb-indexeddb"
        : "tsdb-memory";
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await superinvestorsCollection.preload();
        if (cancelled) return;
        setSuperinvestorsData(
          Array.from(superinvestorsCollection.entries()).map(([, value]) => value),
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const readyCalledRef = useRef(false);
  useEffect(() => {
    const toPerfSource = (
      source: "memory" | "indexeddb" | "api",
    ): PerfSource => {
      if (source === "api") return "api-duckdb";
      if (source === "indexeddb") return "tsdb-indexeddb";
      return "tsdb-memory";
    };

    setDataSource(toPerfSource(getSuperinvestorListLoadSource()));
    return subscribeSuperinvestorListLoadSource((source) => {
      setDataSource(toPerfSource(source));
    });
  }, []);

  useEffect(() => {
    if (readyCalledRef.current) return;
    if (superinvestorsData !== undefined) {
      readyCalledRef.current = true;
      onReady();
    }
  }, [superinvestorsData, onReady]);

  return (
    <PageLayout width="wide">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <SuperinvestorsTableCard
          dataSource={dataSource}
          rows={superinvestorsData || []}
        />
      )}
    </PageLayout>
  );
}
