import { performance } from "perf_hooks";

const BASE_URL = "http://localhost:4000";

const ITERATIONS = 20;
const WARMUP_ITERATIONS = 5;

interface BenchmarkResult {
  label: string;
  times: number[];
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2).padStart(8)}ms`;
}

async function measureEndpoint(url: string): Promise<{
  totalTime: number;
  responseSize: number;
  rowCount: number;
}> {
  const start = performance.now();
  const response = await fetch(url);
  const data = await response.json();
  const totalTime = performance.now() - start;

  const responseSize = JSON.stringify(data).length;
  const rowCount = Array.isArray(data) ? data.length : data.data?.length || 0;

  return { totalTime, responseSize, rowCount };
}

async function benchmarkEndpoint(
  label: string,
  url: string
): Promise<BenchmarkResult> {
  console.log(`\n📊 ${label}`);
  console.log(`   URL: ${url}`);

  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    await measureEndpoint(url);
  }

  // Actual measurements
  const times: number[] = [];
  let lastResponseSize = 0;
  let lastRowCount = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const { totalTime, responseSize, rowCount } = await measureEndpoint(url);
    times.push(totalTime);
    lastResponseSize = responseSize;
    lastRowCount = rowCount;
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const p99 = percentile(times, 99);

  console.log(`   Rows: ${lastRowCount.toLocaleString()}`);
  console.log(`   Size: ${(lastResponseSize / 1024).toFixed(2)} KB`);
  console.log(
    "┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐"
  );
  console.log(
    "│   Stat   │   Avg    │   Min    │   Max    │   P50    │   P95    │"
  );
  console.log(
    "├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤"
  );
  console.log(
    `│ latency  │ ${formatMs(avg)} │ ${formatMs(min)} │ ${formatMs(max)} │ ${formatMs(p50)} │ ${formatMs(p95)} │`
  );
  console.log(
    "└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘"
  );

  return { label, times, avg, min, max, p50, p95, p99 };
}

async function main() {
  console.log("🏁 API Endpoint Benchmark");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Warmup: ${WARMUP_ITERATIONS}, Iterations: ${ITERATIONS}\n`);

  const results: BenchmarkResult[] = [];

  // Test if server is running
  try {
    await fetch(`${BASE_URL}/api/health`);
  } catch (error) {
    console.error(
      "❌ Server not running! Please start the server with 'bun run dev'"
    );
    process.exit(1);
  }

  // 1. Collections endpoints (TanStack DB preload)
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📦 COLLECTION ENDPOINTS (TanStack DB Preload)");
  console.log("═══════════════════════════════════════════════════════");

  results.push(
    await benchmarkEndpoint(
      "Assets Collection (Full)",
      `${BASE_URL}/api/assets`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "Superinvestors Collection (Full)",
      `${BASE_URL}/api/superinvestors`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "Search Index (Pre-computed)",
      `${BASE_URL}/api/duckdb-search/index`
    )
  );

  // 2. Chart data endpoints (React Query)
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📈 CHART DATA ENDPOINTS (React Query)");
  console.log("═══════════════════════════════════════════════════════");

  results.push(
    await benchmarkEndpoint(
      "All Assets Activity (Global)",
      `${BASE_URL}/api/all-assets-activity`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "All Assets Activity (AAPL)",
      `${BASE_URL}/api/all-assets-activity?cusip=037833100`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "Investor Flow (AAPL)",
      `${BASE_URL}/api/investor-flow?ticker=AAPL`
    )
  );

  // 3. Drilldown endpoints (TanStack DB on-demand)
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🔍 DRILLDOWN ENDPOINTS (TanStack DB On-Demand)");
  console.log("═══════════════════════════════════════════════════════");

  results.push(
    await benchmarkEndpoint(
      "Drilldown Single Quarter (AAPL 2024Q3 both)",
      `${BASE_URL}/api/duckdb-investor-drilldown?ticker=AAPL&cusip=037833100&quarter=2024Q3&action=both`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "Drilldown Single Quarter (AAPL 2024Q3 open)",
      `${BASE_URL}/api/duckdb-investor-drilldown?ticker=AAPL&cusip=037833100&quarter=2024Q3&action=open`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "Drilldown All Quarters (AAPL all both)",
      `${BASE_URL}/api/duckdb-investor-drilldown?ticker=AAPL&cusip=037833100&quarter=all&action=both`
    )
  );

  // 4. Search endpoints
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🔎 SEARCH ENDPOINTS");
  console.log("═══════════════════════════════════════════════════════");

  results.push(
    await benchmarkEndpoint(
      "Search Query (apple)",
      `${BASE_URL}/api/duckdb-search?q=apple`
    )
  );

  results.push(
    await benchmarkEndpoint(
      "Search Query (berkshire)",
      `${BASE_URL}/api/duckdb-search?q=berkshire`
    )
  );

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📊 SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  const sortedByAvg = [...results].sort((a, b) => a.avg - b.avg);

  console.log("Fastest to Slowest (by average):\n");
  sortedByAvg.forEach((result, index) => {
    console.log(
      `${(index + 1).toString().padStart(2)}. ${result.label.padEnd(45)} ${formatMs(result.avg)} (p95: ${formatMs(result.p95)})`
    );
  });

  console.log("\n\nBottleneck Analysis:\n");

  const collections = results.filter((r) =>
    r.label.includes("Collection") || r.label.includes("Search Index")
  );
  const charts = results.filter((r) => r.label.includes("Activity") || r.label.includes("Flow"));
  const drilldowns = results.filter((r) => r.label.includes("Drilldown"));

  const avgCollection =
    collections.reduce((sum, r) => sum + r.avg, 0) / collections.length;
  const avgChart = charts.reduce((sum, r) => sum + r.avg, 0) / charts.length;
  const avgDrilldown =
    drilldowns.reduce((sum, r) => sum + r.avg, 0) / drilldowns.length;

  console.log(`Collections (TanStack DB preload):  ${formatMs(avgCollection)}`);
  console.log(`Charts (React Query):                ${formatMs(avgChart)}`);
  console.log(`Drilldowns (TanStack DB on-demand):  ${formatMs(avgDrilldown)}`);

  console.log("\n✅ Benchmark complete!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
