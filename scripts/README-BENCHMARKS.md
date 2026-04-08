# Performance Benchmarking Suite

Comprehensive performance testing tools for the application.

## Quick Start

```bash
# Run all benchmarks
bun run benchmark:all

# Or run individual benchmarks
bun run benchmark:api      # API endpoint performance
bun run benchmark:charts   # Chart rendering performance
bun run benchmark:duckdb   # DuckDB native query performance
```

## Prerequisites

- **API server must be running** on port 4000
- Start with: `bun run dev` or `bun run dev:api`

## Available Benchmarks

### 1. API Endpoint Benchmarks

**Script:** `benchmark-api-endpoints.ts`  
**Command:** `bun run benchmark:api`

Tests HTTP response times for all major API endpoints:

- **Collection endpoints** (TanStack DB preload)
  - Assets collection (39K rows)
  - Superinvestors collection (15K rows)
  - Search index (pre-computed)

- **Chart data endpoints** (React Query)
  - All assets activity (global and filtered)
  - Investor flow data

- **Drilldown endpoints** (TanStack DB on-demand)
  - Single quarter queries
  - All quarters bulk queries

- **Search endpoints**
  - DuckDB full-text search

**Output:**
- Average, min, max, P50, P95 latencies
- Response sizes and row counts
- Category-wise performance summary

### 2. Chart Rendering Benchmarks

**Script:** `benchmark-chart-rendering.html` + `run-chart-benchmark.ts`  
**Command:** `bun run benchmark:charts`

Compares ECharts vs uPlot rendering performance:

- Tests with 100, 500, 1K, 2K, 5K data points
- Measures pure rendering time (no network)
- Runs in real browser (Chromium via Playwright)
- Disables animations for accurate measurements

**Output:**
- Average, min, max, P50, P95, P99 render times
- Winner determination with speedup percentage
- Visual preview of rendered charts

### 3. DuckDB Native Benchmarks

**Script:** `benchmark-duckdb-native.ts`  
**Command:** `bun run benchmark:duckdb`

Tests raw DuckDB query performance:

- Direct @duckdb/node-api queries (no HTTP overhead)
- Typical queries from the application
- Warmup iterations to eliminate cold-start effects

**Output:**
- Query execution times
- Statistical analysis (avg, min, max, percentiles)

## Benchmark Results

Latest results are saved to:
```
docs/PERFORMANCE-BENCHMARKS-YYYY-MM-DD.md
```

## Understanding the Results

### Latency Targets

| Operation | Target | Current Performance |
|-----------|--------|---------------------|
| Chart data fetch | <10ms | ✅ 1-2ms |
| Chart rendering | <50ms | ✅ 8-10ms |
| Drilldown query | <20ms | ✅ 3-8ms |
| Collection preload | <200ms | ✅ 60-96ms |

### What to Look For

**Good signs:**
- ✅ P95 < 2x average (consistent performance)
- ✅ Chart rendering < 20ms (feels instant)
- ✅ API responses < 10ms (sub-frame time)

**Warning signs:**
- ⚠️ P95 > 3x average (high variance)
- ⚠️ Chart rendering > 50ms (noticeable lag)
- ⚠️ API responses > 100ms (user-perceptible delay)

## Customizing Benchmarks

### API Endpoint Benchmarks

Edit `benchmark-api-endpoints.ts`:

```typescript
const ITERATIONS = 20;           // Number of test runs
const WARMUP_ITERATIONS = 5;     // Warmup runs (excluded from stats)
const BASE_URL = "http://localhost:4000";  // API server URL
```

Add new endpoints:

```typescript
results.push(
  await benchmarkEndpoint(
    "My New Endpoint",
    `${BASE_URL}/api/my-endpoint?param=value`
  )
);
```

### Chart Rendering Benchmarks

Edit `benchmark-chart-rendering.html`:

```javascript
const dataSizes = [100, 500, 1000, 2000, 5000];  // Test data sizes
const iterations = 10;                            // Iterations per size
```

### DuckDB Benchmarks

Edit `benchmark-duckdb-native.ts`:

```typescript
const ITERATIONS = 20;
const WARMUP_ITERATIONS = 5;
const DB_PATH = "/path/to/your/duckdb/file.duckdb";
```

Add new queries:

```typescript
const myQuery = `
  SELECT * FROM my_table
  WHERE condition = true
`;

await benchmarkQuery(connection, "My Query Description", myQuery);
```

## Troubleshooting

### "Server not running" error

Make sure the API server is running:
```bash
bun run dev
# or
bun run dev:api
```

### "Browser not installed" error

Install Playwright browsers:
```bash
bun x playwright install chromium
```

### Inconsistent results

- Close other applications to reduce system load
- Run benchmarks multiple times and average results
- Increase `ITERATIONS` for more stable statistics
- Check for background processes (Docker, databases, etc.)

### Slow chart benchmarks

The chart benchmark opens a real browser window. This is intentional to measure real-world performance. If it's too slow:

1. Reduce data sizes in `run-chart-benchmark.ts`
2. Reduce iterations
3. Run in headless mode (edit script to set `headless: true`)

## Best Practices

1. **Run benchmarks on a quiet system** - Close unnecessary apps
2. **Run multiple times** - Performance can vary between runs
3. **Compare trends** - Look for regressions over time
4. **Document changes** - Note what changed between benchmark runs
5. **Use consistent hardware** - Don't compare results from different machines

## Integration with CI/CD

To run benchmarks in CI:

```yaml
# Example GitHub Actions workflow
- name: Run Performance Benchmarks
  run: |
    bun run dev:api &
    sleep 5
    bun run benchmark:api
    bun run benchmark:duckdb
```

Note: Chart benchmarks require a display server (use `xvfb` in CI).

## Contributing

When adding new benchmarks:

1. Follow the existing patterns
2. Include warmup iterations
3. Calculate percentiles (P50, P95, P99)
4. Format output consistently
5. Update this README
6. Document expected performance ranges

## Questions?

See the main performance analysis document:
```
docs/PERFORMANCE-BENCHMARKS-2025-12-12.md
```
