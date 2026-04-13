import { performance } from "perf_hooks";

const BASE_URL = process.env.BENCHMARK_BASE_URL || "http://localhost:4000";
const CONCURRENCY = Number(process.env.ROLL_OVER_CONCURRENCY || 8);
const ITERATIONS = Number(process.env.ROLL_OVER_ITERATIONS || 5);
const STATUS_PATH = `${BASE_URL}/api/db-status`;
const ASSETS_PATH = `${BASE_URL}/api/assets?limit=100`;
const SEARCH_PATH = `${BASE_URL}/api/duckdb-search?q=apple&limit=20`;

async function measure(url: string) {
  const startedAt = performance.now();
  const response = await fetch(url);
  const body = await response.text();
  const durationMs = performance.now() - startedAt;
  return {
    url,
    status: response.status,
    durationMs,
    bytes: body.length,
  };
}

async function runBatch(label: string, url: string) {
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => measure(url))
  );

  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)];
  console.log(`${label}: avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms statuses=${results.map((r) => r.status).join(",")}`);
}

async function logDbStatus() {
  const response = await fetch(STATUS_PATH);
  console.log(`db-status ${response.status}: ${await response.text()}`);
}

async function main() {
  console.log(`Rollover benchmark against ${BASE_URL}`);
  await logDbStatus();

  for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
    console.log(`\nIteration ${iteration}/${ITERATIONS}`);
    await runBatch("assets", ASSETS_PATH);
    await runBatch("search", SEARCH_PATH);
    await logDbStatus();
  }
}

main().catch((error) => {
  console.error("Benchmark failed", error);
  process.exit(1);
});
