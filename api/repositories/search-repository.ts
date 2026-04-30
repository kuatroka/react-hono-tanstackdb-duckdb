import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runPreparedAndGetRows } from "../db/query-runner";

const MISSING_CIK_NAME_SENTINEL = "!!! no cik_name found !!!";
const ASSET_SEARCH_NAME_SQL = "COALESCE(NULLIF(TRIM(cusip_md.cusip_ticker_name), ''), NULLIF(TRIM(searches.name), ''), searches.code)";
const SEARCH_DISPLAY_NAME_SQL = `CASE WHEN searches.category = 'assets' THEN ${ASSET_SEARCH_NAME_SQL} ELSE searches.name END`;

function normalizeSearchName(name: string | null | undefined, code: string, category: string) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === MISSING_CIK_NAME_SENTINEL) {
    return category === "superinvestors" ? `Unknown filer (${code})` : code;
  }
  return trimmed;
}

export async function fullDumpSearches(c: DuckDbLeaseContext, params: { cursor?: string | null; pageSize: number }) {
  const lease = getDuckDbLease(c);
  return lease.run("search.fullDump", async (connection: DuckDbConnection) => {
    const cursorValue = params.cursor ? parseInt(params.cursor, 10) : null;
    const pageSizePlusOne = params.pageSize + 1;

    if (cursorValue !== null) {
      const stmt = await connection.prepare(`
        SELECT
          searches.id,
          searches.cusip,
          searches.code,
          ${SEARCH_DISPLAY_NAME_SQL} as name,
          searches.category
        FROM searches
        LEFT JOIN cusip_md ON searches.category = 'assets' AND searches.cusip = cusip_md.cusip
        WHERE searches.id > ?
        ORDER BY searches.id ASC
        LIMIT ?
      `);
      stmt.bindInteger(1, cursorValue);
      stmt.bindInteger(2, pageSizePlusOne);
      const rows = await runPreparedAndGetRows(stmt);
      const items = rows.slice(0, params.pageSize).map((row: unknown[]) => ({
        id: Number(row[0]),
        cusip: row[1],
        code: row[2],
        name: row[3],
        category: row[4],
      }));

      const hasMore = rows.length > params.pageSize;
      const nextCursor = hasMore ? String(items[items.length - 1].id) : null;
      return { items, nextCursor };
    }

    const stmt = await connection.prepare(`
      SELECT
        searches.id,
        searches.cusip,
        searches.code,
        ${SEARCH_DISPLAY_NAME_SQL} as name,
        searches.category
      FROM searches
      LEFT JOIN cusip_md ON searches.category = 'assets' AND searches.cusip = cusip_md.cusip
      ORDER BY searches.id ASC
      LIMIT ?
    `);
    stmt.bindInteger(1, pageSizePlusOne);
    const rows = await runPreparedAndGetRows(stmt);
    const items = rows.slice(0, params.pageSize).map((row: unknown[]) => ({
      id: Number(row[0]),
      cusip: row[1],
      code: row[2],
      name: row[3],
      category: row[4],
    }));

    const hasMore = rows.length > params.pageSize;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : null;
    return { items, nextCursor };
  });
}

export async function searchDuckDb(c: DuckDbLeaseContext, params: { query: string; limit: number }) {
  const lease = getDuckDbLease(c);
  return lease.run("search.query", async (connection: DuckDbConnection) => {
    const exactCode = params.query;
    const codePrefix = `${params.query}%`;
    const containsPattern = `%${params.query}%`;
    const stmt = await connection.prepare(`
      WITH candidate_ids AS (
        SELECT
          id,
          CASE
            WHEN LOWER(code) = LOWER(?) THEN 100
            WHEN LOWER(code) LIKE LOWER(?) THEN 80
            WHEN LOWER(code) LIKE LOWER(?) THEN 60
            ELSE 0
          END AS score
        FROM searches
        WHERE category = 'assets'
          AND (LOWER(code) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?))

        UNION ALL

        SELECT
          searches.id,
          CASE
            WHEN LOWER(cusip_md.cusip_ticker_name) LIKE LOWER(?) THEN 40
            ELSE 20
          END AS score
        FROM cusip_md
        JOIN searches ON searches.category = 'assets' AND searches.cusip = cusip_md.cusip
        WHERE LOWER(cusip_md.cusip_ticker_name) LIKE LOWER(?)

        UNION ALL

        SELECT
          id,
          CASE
            WHEN LOWER(code) = LOWER(?) THEN 100
            WHEN LOWER(code) LIKE LOWER(?) THEN 80
            WHEN LOWER(code) LIKE LOWER(?) THEN 60
            WHEN LOWER(name) LIKE LOWER(?) THEN 40
            WHEN LOWER(name) LIKE LOWER(?) THEN 20
            ELSE 0
          END AS score
        FROM searches
        WHERE category <> 'assets'
          AND (LOWER(code) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?))
      ),
      ranked_ids AS (
        SELECT id, MAX(score) AS score
        FROM candidate_ids
        GROUP BY id
      )
      SELECT
        searches.id,
        searches.cusip,
        searches.code,
        ${SEARCH_DISPLAY_NAME_SQL} as name,
        searches.category,
        ranked_ids.score
      FROM ranked_ids
      JOIN searches ON searches.id = ranked_ids.id
      LEFT JOIN cusip_md ON searches.category = 'assets' AND searches.cusip = cusip_md.cusip
      WHERE ranked_ids.score > 0
      ORDER BY ranked_ids.score DESC, name ASC
      LIMIT ?
    `);
    stmt.bindVarchar(1, exactCode);
    stmt.bindVarchar(2, codePrefix);
    stmt.bindVarchar(3, containsPattern);
    stmt.bindVarchar(4, containsPattern);
    stmt.bindVarchar(5, containsPattern);
    stmt.bindVarchar(6, codePrefix);
    stmt.bindVarchar(7, containsPattern);
    stmt.bindVarchar(8, exactCode);
    stmt.bindVarchar(9, codePrefix);
    stmt.bindVarchar(10, containsPattern);
    stmt.bindVarchar(11, codePrefix);
    stmt.bindVarchar(12, containsPattern);
    stmt.bindVarchar(13, containsPattern);
    stmt.bindVarchar(14, containsPattern);
    stmt.bindInteger(15, params.limit);

    const rows = await runPreparedAndGetRows(stmt);
    return rows.map((row: unknown[]) => {
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
  });
}

export async function getAssetSearchNameMap(c: DuckDbLeaseContext): Promise<Map<string, string>> {
  const lease = getDuckDbLease(c);
  return lease.run("search.assetNameMap", async (connection: DuckDbConnection) => {
    const rows = await runPreparedAndGetRows(await connection.prepare(`
      SELECT
        cusip,
        cusip_ticker_name
      FROM cusip_md
      WHERE cusip_ticker_name IS NOT NULL
        AND TRIM(cusip_ticker_name) <> ''
    `));

    return new Map(rows.map((row) => [String(row[0]), String(row[1]).trim()]));
  });
}
