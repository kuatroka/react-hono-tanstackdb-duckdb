import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runPreparedAndGetRows } from "../db/query-runner";

const MISSING_CIK_NAME_SENTINEL = "!!! no cik_name found !!!";

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
          id,
          cusip,
          code,
          name,
          category
        FROM searches
        WHERE id > ?
        ORDER BY id ASC
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
        id,
        cusip,
        code,
        name,
        category
      FROM searches
      ORDER BY id ASC
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
      SELECT
        id,
        cusip,
        code,
        name,
        category,
        CASE
          WHEN LOWER(code) = LOWER(?) THEN 100
          WHEN LOWER(code) LIKE LOWER(?) THEN 80
          WHEN LOWER(code) LIKE LOWER(?) THEN 60
          WHEN LOWER(name) LIKE LOWER(?) THEN 40
          WHEN LOWER(name) LIKE LOWER(?) THEN 20
          ELSE 0
        END AS score
      FROM searches
      WHERE LOWER(code) LIKE LOWER(?)
         OR LOWER(name) LIKE LOWER(?)
      ORDER BY score DESC, name ASC
      LIMIT ?
    `);
    stmt.bindVarchar(1, exactCode);
    stmt.bindVarchar(2, codePrefix);
    stmt.bindVarchar(3, containsPattern);
    stmt.bindVarchar(4, codePrefix);
    stmt.bindVarchar(5, containsPattern);
    stmt.bindVarchar(6, containsPattern);
    stmt.bindVarchar(7, containsPattern);
    stmt.bindInteger(8, params.limit);

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
