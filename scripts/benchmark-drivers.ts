/**
 * Benchmark Script: Compare Hono API (postgres npm) vs Bun Native SQL
 * 
 * Run with: bun run scripts/benchmark-drivers.ts
 * 
 * Prerequisites:
 * - Hono API running on port 3005
 * - Bun Native SQL server running on port 3006
 */

const HONO_PORT = 4000;
const BUN_NATIVE_PORT = 3006;
const ITERATIONS = 20;
const WARMUP_ITERATIONS = 5;

interface BenchmarkResult {
  driver: string;
  endpoint: string;
  warmupAvg: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

async function measureRequest(url: string): Promise<number> {
  const start = performance.now();
  const response = await fetch(url);
  await response.json(); // Consume the body
  return performance.now() - start;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function benchmark(
  driver: string,
  port: number,
  endpoint: string
): Promise<BenchmarkResult> {
  const url = `http://localhost:${port}${endpoint}`;
  
  // Warmup
  const warmupTimes: number[] = [];
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    warmupTimes.push(await measureRequest(url));
  }
  
  // Actual benchmark
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    times.push(await measureRequest(url));
  }
  
  return {
    driver,
    endpoint,
    warmupAvg: warmupTimes.reduce((a, b) => a + b, 0) / warmupTimes.length,
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
  };
}

function formatMs(ms: number): string {
  return ms.toFixed(2).padStart(8) + 'ms';
}

async function runBenchmarks() {
  console.log('🏁 Driver Benchmark: Hono (postgres npm) vs Bun Native SQL\n');
  console.log(`   Warmup iterations: ${WARMUP_ITERATIONS}`);
  console.log(`   Benchmark iterations: ${ITERATIONS}\n`);
  
  const endpoints = [
    '/drilldown/AAPL?quarter=2024Q3&action=open',
    '/drilldown/MSFT?quarter=2024Q3&action=close',
    '/drilldown/AAPL/summary',
  ];
  
  // Check if servers are running
  try {
    await fetch(`http://localhost:${HONO_PORT}/api/drilldown/AAPL?limit=1`);
  } catch {
    console.error(`❌ Hono API not running on port ${HONO_PORT}`);
    console.error(`   Start with: bun run dev`);
    process.exit(1);
  }
  
  try {
    await fetch(`http://localhost:${BUN_NATIVE_PORT}/drilldown/AAPL?limit=1`);
  } catch {
    console.error(`❌ Bun Native SQL server not running on port ${BUN_NATIVE_PORT}`);
    console.error(`   Start with: bun run api/bun-native-benchmark.ts`);
    process.exit(1);
  }
  
  console.log('✅ Both servers are running\n');
  console.log('─'.repeat(100));
  
  for (const endpoint of endpoints) {
    console.log(`\n📊 Endpoint: ${endpoint}\n`);
    
    // Hono API (note: /api prefix)
    const honoResult = await benchmark('Hono (postgres)', HONO_PORT, `/api${endpoint}`);
    
    // Bun Native SQL
    const bunResult = await benchmark('Bun Native SQL', BUN_NATIVE_PORT, endpoint);
    
    // Print results
    console.log('┌─────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
    console.log('│ Driver              │ Avg      │ Min      │ Max      │ P50      │ P95      │ P99      │');
    console.log('├─────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');
    
    for (const result of [honoResult, bunResult]) {
      console.log(
        `│ ${result.driver.padEnd(19)} │` +
        `${formatMs(result.avg)} │` +
        `${formatMs(result.min)} │` +
        `${formatMs(result.max)} │` +
        `${formatMs(result.p50)} │` +
        `${formatMs(result.p95)} │` +
        `${formatMs(result.p99)} │`
      );
    }
    
    console.log('└─────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');
    
    // Calculate speedup
    const speedup = honoResult.avg / bunResult.avg;
    const faster = speedup > 1 ? 'Bun Native' : 'Hono';
    const ratio = speedup > 1 ? speedup : 1 / speedup;
    
    console.log(`\n   ${faster} is ${ratio.toFixed(2)}x faster (avg)`);
  }
  
  console.log('\n' + '─'.repeat(100));
  console.log('\n✅ Benchmark complete!\n');
}

runBenchmarks().catch(console.error);
