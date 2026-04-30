import { Hono } from "hono";
import { fullDumpSearches, getAssetSearchNameMap, searchDuckDb } from "../repositories/search-repository";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { compactSearchIndexPayload, type CompactSearchIndexPayload, type SearchIndexItemTuple } from "../../src/lib/search-index";

const searchDuckdbRoutes = new Hono();
let cachedCompactIndex:
  | {
      path: string;
      mtimeMs: number;
      body: string;
    }
  | null = null;

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

async function enrichAssetSearchIndexPayload(c: Parameters<typeof getAssetSearchNameMap>[0], payload: CompactSearchIndexPayload): Promise<CompactSearchIndexPayload> {
  const assetItemsNeedingNames = payload.items.some((item) => (
    item[4] === "assets" &&
    item[1] &&
    (!item[3] || item[3] === item[2])
  ));

  if (!assetItemsNeedingNames) {
    return payload;
  }

  const assetNameByCusip = await getAssetSearchNameMap(c);
  if (assetNameByCusip.size === 0) {
    return payload;
  }

  let changed = false;
  const items = payload.items.map((item): SearchIndexItemTuple => {
    if (item[4] !== "assets" || !item[1] || (item[3] && item[3] !== item[2])) {
      return item;
    }

    const assetName = assetNameByCusip.get(item[1]);
    if (!assetName || assetName === item[2]) {
      return item;
    }

    changed = true;
    return [item[0], item[1], item[2], assetName, item[4]];
  });

  return changed
    ? {
        ...payload,
        items,
      }
    : payload;
}

async function loadCompactSearchIndexBody(c: Parameters<typeof getAssetSearchNameMap>[0], indexPath: string): Promise<string> {
  const fileStats = await stat(indexPath);

  if (
    cachedCompactIndex &&
    cachedCompactIndex.path === indexPath &&
    cachedCompactIndex.mtimeMs === fileStats.mtimeMs
  ) {
    return cachedCompactIndex.body;
  }

  const indexData = await readFile(indexPath, "utf-8");
  const compactPayload = await enrichAssetSearchIndexPayload(c, compactSearchIndexPayload(JSON.parse(indexData)));
  compactPayload.metadata = {
    ...compactPayload.metadata,
    totalItems: compactPayload.metadata?.totalItems ?? compactPayload.items.length,
    indexFileBytes: fileStats.size,
    compactBytes: Buffer.byteLength(JSON.stringify(compactPayload), "utf-8"),
  };
  const compactBody = JSON.stringify(compactPayload);

  cachedCompactIndex = {
    path: indexPath,
    mtimeMs: fileStats.mtimeMs,
    body: compactBody,
  };

  return compactBody;
}

searchDuckdbRoutes.get("/index", async (c) => {
  try {
    const indexPath = resolveSearchIndexPath();
    if (!indexPath) {
      return c.json({ error: "SEARCH_INDEX_PATH or APP_DATA_PATH not configured" }, 500);
    }

    const indexData = await loadCompactSearchIndexBody(c, indexPath);

    c.header("Cache-Control", "public, max-age=3600");
    c.header("Content-Type", "application/json");

    return c.body(indexData);
  } catch (error) {
    console.error("[DuckDB Search Index] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("ENOENT")) {
      return c.json({
        items: [],
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
    const { items, nextCursor } = await fullDumpSearches(c, { cursor, pageSize });

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
    const results = await searchDuckDb(c, { query, limit });
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
