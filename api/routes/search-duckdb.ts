import { Hono } from "hono";
import { getDuckDBConnection } from "../duckdb";
import { readFile } from "fs/promises";
import { join } from "path";

const searchDuckdbRoutes = new Hono();
const MISSING_CIK_NAME_SENTINEL = "!!! no cik_name found !!!";

function normalizeSearchName(name: string | null | undefined, code: string, category: string) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === MISSING_CIK_NAME_SENTINEL) {
    return category === "superinvestors" ? `Unknown filer (${code})` : code;
  }
  return trimmed;
}

function resolveSearchIndexPath(): string | null {
  const rawPath = process.env.SEARCH_INDEX_PATH;
  if (rawPath) {
    const expanded = rawPath.replace(/\$\{([^}]+)\}/g, (_, name) => {
      const v = process.env[name];
      return v ?? "";
    });
    if (expanded) return expanded;
  }

  const appDataPath = process.env.APP_DATA_PATH;
  if (!appDataPath) return null;

  return join(appDataPath, "TR_05_DB", "TR_05_WEB_SEARCH_INDEX", "search_index.json");
}

searchDuckdbRoutes.get("/index", async (c) => {
  try {
    const indexPath = resolveSearchIndexPath();
    if (!indexPath) {
      return c.json({ error: "SEARCH_INDEX_PATH or APP_DATA_PATH not configured" }, 500);
    }

    const indexData = await readFile(indexPath, "utf-8");

    c.header("Cache-Control", "public, max-age=3600");
    c.header("Content-Type", "application/json");

    return c.body(indexData);
  } catch (error) {
    console.error("[DuckDB Search Index] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("ENOENT")) {
      return c.json({
        codeExact: {},
        codePrefixes: {},
        namePrefixes: {},
        items: {},
        metadata: { totalItems: 0, error: "Index not generated yet" },
      });
    }

    return c.json({ error: "Failed to load search index", details: errorMessage }, 500);
  }
});

/**
 * GET /api/duckdb-search/full-dump?cursor=<id>&pageSize=<n>
 *
 * Export all rows from the `searches` table in DuckDB with cursor-based pagination.
 * Used for bulk sync to IndexedDB via TanStack DB.
 */
searchDuckdbRoutes.get("/full-dump", async (c) => {
  const cursor = c.req.query("cursor");
  const pageSize = Math.min(parseInt(c.req.query("pageSize") || "1000", 10), 5000);

  try {
    const conn = await getDuckDBConnection();

    let sql: string;
    if (cursor) {
      // Fetch rows after the cursor (by id)
      sql = `
        SELECT 
          id,
          cusip,
          code,
          name,
          category
        FROM searches
        WHERE id > ${parseInt(cursor, 10)}
        ORDER BY id ASC
        LIMIT ${pageSize + 1}
      `;
    } else {
      // First page: fetch from the beginning
      sql = `
        SELECT 
          id,
          cusip,
          code,
          name,
          category
        FROM searches
        ORDER BY id ASC
        LIMIT ${pageSize + 1}
      `;
    }

    const reader = await conn.runAndReadAll(sql);
    const rows = reader.getRows();

    // Convert to objects
    const items = rows.slice(0, pageSize).map((row: any[]) => ({
      id: Number(row[0]),
      cusip: row[1],
      code: row[2],
      name: row[3],
      category: row[4],
    }));

    // Determine if there are more rows
    const hasMore = rows.length > pageSize;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

    return c.json({
      items,
      nextCursor,
    });
  } catch (error) {
    console.error("[DuckDB Full-Dump] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Full-dump failed", details: errorMessage }, 500);
  }
});

/**
 * GET /api/duckdb-search?q=<query>&limit=<n>
 *
 * Search the `searches` table in DuckDB.
 * Returns ranked results: exact code > code starts with > code contains > name matches.
 */
searchDuckdbRoutes.get("/", async (c) => {
  const query = (c.req.query("q") || "").trim();
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);

  // Minimum 2 characters required
  if (query.length < 2) {
    return c.json({ results: [], queryTimeMs: 0 });
  }

  try {
    const startTime = performance.now();
    const conn = await getDuckDBConnection();

    // Escape single quotes for SQL
    const escaped = query.replace(/'/g, "''");
    const pattern = `%${escaped}%`;

    // Query with ranking:
    // - score 100: exact code match (case-insensitive)
    // - score 80: code starts with query
    // - score 60: code contains query
    // - score 40: name starts with query
    // - score 20: name contains query
    const sql = `
      SELECT 
        id,
        cusip,
        code,
        name,
        category,
        CASE
          WHEN LOWER(code) = LOWER('${escaped}') THEN 100
          WHEN LOWER(code) LIKE LOWER('${escaped}%') THEN 80
          WHEN LOWER(code) LIKE LOWER('${pattern}') THEN 60
          WHEN LOWER(name) LIKE LOWER('${escaped}%') THEN 40
          WHEN LOWER(name) LIKE LOWER('${pattern}') THEN 20
          ELSE 0
        END AS score
      FROM searches
      WHERE LOWER(code) LIKE LOWER('${pattern}')
         OR LOWER(name) LIKE LOWER('${pattern}')
      ORDER BY score DESC, name ASC
      LIMIT ${limit}
    `;

    const reader = await conn.runAndReadAll(sql);
    const rows = reader.getRows();

    // Convert to objects
    const results = rows.map((row: any[]) => {
      const code = String(row[2]);
      const category = String(row[4]);
      return {
        id: Number(row[0]),
        cusip: row[1],
        code,
        name: normalizeSearchName(row[3] as string | null, code, category),
        category,
        score: Number(row[5]),
      };
    });

    const queryTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return c.json({
      results,
      count: results.length,
      queryTimeMs,
    });
  } catch (error) {
    console.error("[DuckDB Search] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Search failed", details: errorMessage }, 500);
  }
});

export default searchDuckdbRoutes;
