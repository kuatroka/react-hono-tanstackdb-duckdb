/**
 * Bun Native SQL Benchmark Server
 * 
 * This server uses Bun's native SQL bindings instead of the `postgres` npm package.
 * Run with: bun run api/bun-native-benchmark.ts
 * 
 * Compare performance against the Hono API on port 3005.
 */

import { SQL } from "bun";

// Use Bun's native SQL with PostgreSQL
const connectionString = process.env.ZERO_UPSTREAM_DB || "postgresql://user:password@127.0.0.1:5432/postgres";
const sql = new SQL(connectionString);

// Base path for parquet files (inside Docker container)
const PARQUET_BASE_PATH = "/app_data/TR_BY_TICKER_CONSOLIDATED";

/**
 * Build the parquet query with pg_duckdb syntax
 */
function buildDrilldownQuery(
  ticker: string,
  quarter: string | null,
  action: string | null,
  limit: number
): string {
  const parquetPath = `${PARQUET_BASE_PATH}/cusip_ticker=${ticker}/*.parquet`;

  let whereClause = "1=1";

  if (quarter) {
    whereClause += ` AND r['quarter'] = '${quarter}'`;
  }

  if (action) {
    const actionMap: Record<string, string> = {
      open: "did_open",
      add: "did_add",
      reduce: "did_reduce",
      close: "did_close",
      hold: "did_hold",
    };
    const column = actionMap[action.toLowerCase()];
    if (column) {
      whereClause += ` AND r['${column}'] = true`;
    }
  }

  return `
    SELECT 
      r['cusip']::TEXT as cusip,
      r['quarter']::TEXT as quarter,
      r['cik']::BIGINT as cik,
      r['did_open']::BOOLEAN as did_open,
      r['did_add']::BOOLEAN as did_add,
      r['did_reduce']::BOOLEAN as did_reduce,
      r['did_close']::BOOLEAN as did_close,
      r['did_hold']::BOOLEAN as did_hold,
      r['cusip_ticker']::TEXT as cusip_ticker
    FROM read_parquet('${parquetPath}') r
    WHERE ${whereClause}
    LIMIT ${limit}
  `;
}

/**
 * Build summary query for a ticker
 */
function buildSummaryQuery(ticker: string, quarter: string | null): string {
  const parquetPath = `${PARQUET_BASE_PATH}/cusip_ticker=${ticker}/*.parquet`;

  let whereClause = "1=1";
  if (quarter) {
    whereClause += ` AND r['quarter'] = '${quarter}'`;
  }

  return `
    SELECT 
      r['quarter']::TEXT as quarter,
      COUNT(*) FILTER (WHERE r['did_open'] = true) as open_count,
      COUNT(*) FILTER (WHERE r['did_add'] = true) as add_count,
      COUNT(*) FILTER (WHERE r['did_reduce'] = true) as reduce_count,
      COUNT(*) FILTER (WHERE r['did_close'] = true) as close_count,
      COUNT(*) FILTER (WHERE r['did_hold'] = true) as hold_count,
      COUNT(*) as total_count
    FROM read_parquet('${parquetPath}') r
    WHERE ${whereClause}
    GROUP BY r['quarter']
    ORDER BY r['quarter'] DESC
  `;
}

// Parse URL and extract params
function parseRequest(url: URL): {
  path: string;
  ticker: string | null;
  isSummary: boolean;
  quarter: string | null;
  action: string | null;
  limit: number;
} {
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);

  // Expected: /drilldown/:ticker or /drilldown/:ticker/summary
  const ticker = parts[1]?.toUpperCase() || null;
  const isSummary = parts[2] === 'summary';

  return {
    path,
    ticker,
    isSummary,
    quarter: url.searchParams.get('quarter'),
    action: url.searchParams.get('action'),
    limit: parseInt(url.searchParams.get('limit') || '500', 10),
  };
}

const PORT = 3006;

void Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', driver: 'bun-native-sql' });
    }

    // Only handle /drilldown routes
    if (!url.pathname.startsWith('/drilldown/')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const { ticker, isSummary, quarter, action, limit } = parseRequest(url);

    if (!ticker) {
      return Response.json({ error: 'Ticker required' }, { status: 400 });
    }

    try {
      const startTime = performance.now();

      let result: any[];
      let query: string;

      if (isSummary) {
        query = buildSummaryQuery(ticker, quarter);
        result = await sql.unsafe(query);

        const queryTime = performance.now() - startTime;

        return Response.json({
          ticker,
          quarter,
          queryTimeMs: Math.round(queryTime * 100) / 100,
          driver: 'bun-native-sql',
          summary: result,
        });
      } else {
        query = buildDrilldownQuery(ticker, quarter, action, limit);
        result = await sql.unsafe(query);

        const queryTime = performance.now() - startTime;

        return Response.json({
          ticker,
          quarter,
          action,
          count: result.length,
          queryTimeMs: Math.round(queryTime * 100) / 100,
          driver: 'bun-native-sql',
          data: result,
        });
      }
    } catch (error) {
      console.error("Query error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("No files found") || errorMessage.includes("does not exist")) {
        return Response.json({
          error: `No data found for ticker: ${ticker}`,
          ticker,
        }, { status: 404 });
      }

      return Response.json({
        error: "Failed to query",
        details: errorMessage,
      }, { status: 500 });
    }
  },
});

console.log(`🚀 Bun Native SQL Benchmark Server running on http://localhost:${PORT}`);
console.log(`   Driver: Bun native SQL bindings`);
console.log(`   Compare with Hono API on port 3005`);
console.log(`\n   Test endpoints:`);
console.log(`   - http://localhost:${PORT}/drilldown/AAPL?quarter=2024Q3&action=open`);
console.log(`   - http://localhost:${PORT}/drilldown/AAPL/summary`);
