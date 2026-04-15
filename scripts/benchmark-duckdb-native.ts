import { DuckDBInstance } from "@duckdb/node-api";

const DB_PATH = "/Users/yo_macbook/Documents/app_data/TR_05_DB/TR_05_DUCKDB_FILE.duckdb";

const ITERATIONS = 20;
const WARMUP_ITERATIONS = 5;

function nowMs() {
  return performance.now();
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function measure(connection: any, sql: string): Promise<number> {
  const start = nowMs();
  await connection.run(sql);
  return nowMs() - start;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2).padStart(8)}ms`;
}

async function benchmarkQuery(connection: any, label: string, sql: string) {
  console.log(`\n📊 ${label}`);

  // Warmup
  const warmup: number[] = [];
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    warmup.push(await measure(connection, sql));
  }

  // Actual
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    times.push(await measure(connection, sql));
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const p99 = percentile(times, 99);

  console.log("┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐");
  console.log("│   Stat   │   Avg    │   Min    │   Max    │   P50    │   P95    │");
  console.log("├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤");
  console.log(
    `│ latency  │ ${formatMs(avg)} │ ${formatMs(min)} │ ${formatMs(max)} │ ${formatMs(p50)} │ ${formatMs(p95)} │`
  );
  console.log("└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘");
}

async function main() {
  console.log("🏁 DuckDB Native (Node Neo) Benchmark\n");
  console.log(`DB: ${DB_PATH}`);
  console.log(`Warmup: ${WARMUP_ITERATIONS}, Iterations: ${ITERATIONS}`);

  const instance = await DuckDBInstance.create(DB_PATH, { threads: "4" });
  const connection = await instance.connect();

  // Queries equivalent to the Postgres/pg_duckdb benchmarks
  const qAaplOpen = `
    SELECT cusip, quarter, cik, did_open, did_add, did_reduce, did_close, did_hold
    FROM cusip_quarter_investor_activity_detail
    WHERE ticker = 'AAPL'
      AND quarter = '2024Q3'
      AND did_open = true
  `;

  const qMsftClose = `
    SELECT cusip, quarter, cik, did_open, did_add, did_reduce, did_close, did_hold
    FROM cusip_quarter_investor_activity_detail
    WHERE ticker = 'MSFT'
      AND quarter = '2024Q3'
      AND did_close = true
  `;

  const qAaplSummary = `
    SELECT
      quarter,
      COUNT(*) FILTER (WHERE did_open)  AS open_count,
      COUNT(*) FILTER (WHERE did_add)   AS add_count,
      COUNT(*) FILTER (WHERE did_reduce) AS reduce_count,
      COUNT(*) FILTER (WHERE did_close) AS close_count,
      COUNT(*) FILTER (WHERE did_hold)  AS hold_count,
      COUNT(*)                          AS total_count
    FROM cusip_quarter_investor_activity_detail
    WHERE ticker = 'AAPL'
    GROUP BY quarter
    ORDER BY quarter DESC
  `;

  await benchmarkQuery(connection, "AAPL 2024Q3 open (no LIMIT)", qAaplOpen);
  await benchmarkQuery(connection, "MSFT 2024Q3 close (no LIMIT)", qMsftClose);
  await benchmarkQuery(connection, "AAPL summary by quarter", qAaplSummary);

  connection.closeSync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
