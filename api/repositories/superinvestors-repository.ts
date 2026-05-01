import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runPreparedAndGetRows } from "../db/query-runner";

const MISSING_CIK_NAME_SENTINEL = "!!! no cik_name found !!!";

function normalizeSuperinvestorName(name: string | null | undefined, cik: string) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === MISSING_CIK_NAME_SENTINEL) {
    return `Unknown filer (${cik})`;
  }
  return trimmed;
}

export interface ListSuperinvestorsResult {
  rows: Array<{
    id: string;
    cik: string;
    cikName: string;
  }>;
  totalCount: number;
  limitApplied: number;
  offset: number;
  complete: boolean;
}

export async function listSuperinvestors(
  c: DuckDbLeaseContext,
  params: { limit: number; offset: number },
): Promise<ListSuperinvestorsResult> {
  const lease = getDuckDbLease(c);
  return lease.run("superinvestors.list", async (connection: DuckDbConnection) => {
    const countStmt = await connection.prepare(`
      SELECT COUNT(*)
      FROM superinvestors
    `);
    const countRows = await runPreparedAndGetRows(countStmt);
    const totalCount = Number(countRows[0]?.[0]) || 0;

    const stmt = await connection.prepare(`
      SELECT
        cik,
        cik_name as "cikName"
      FROM superinvestors
      ORDER BY cik_name ASC, cik ASC
      LIMIT ? OFFSET ?
    `);
    stmt.bindInteger(1, params.limit);
    stmt.bindInteger(2, params.offset);

    const rows = await runPreparedAndGetRows(stmt);
    const resultRows = rows.map((row: unknown[]) => {
      const cik = String(row[0]);
      return {
        id: cik,
        cik,
        cikName: normalizeSuperinvestorName(row[1] as string | null, cik),
      };
    });

    return {
      rows: resultRows,
      totalCount,
      limitApplied: params.limit,
      offset: params.offset,
      complete: params.offset + resultRows.length >= totalCount,
    };
  });
}

export async function getSuperinvestorByCik(c: DuckDbLeaseContext, cik: string) {
  const lease = getDuckDbLease(c);
  return lease.run("superinvestors.getByCik", async (connection: DuckDbConnection) => {
    const stmt = await connection.prepare(`
      SELECT
        cik,
        cik_name as "cikName"
      FROM superinvestors
      WHERE cik = ?
      LIMIT 1
    `);
    stmt.bindVarchar(1, cik);
    const reader = await stmt.runAndReadAll();
    const rows = reader.getRows();

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const cikValue = String(row[0]);
    return {
      id: cikValue,
      cik: cikValue,
      cikName: normalizeSuperinvestorName(row[1] as string | null, cikValue),
    };
  });
}
