import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runAndGetRows } from "../db/query-runner";

const MISSING_CIK_NAME_SENTINEL = "!!! no cik_name found !!!";

function normalizeSuperinvestorName(name: string | null | undefined, cik: string) {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === MISSING_CIK_NAME_SENTINEL) {
    return `Unknown filer (${cik})`;
  }
  return trimmed;
}

export async function listSuperinvestors(c: DuckDbLeaseContext, params: { limit: number; offset: number }) {
  const lease = getDuckDbLease(c);
  return lease.run("superinvestors.list", async (connection: DuckDbConnection) => {
    const sql = `
      SELECT
        cik,
        cik_name as "cikName"
      FROM superinvestors
      ORDER BY cik_name ASC
      LIMIT ${params.limit} OFFSET ${params.offset}
    `;

    const rows = await runAndGetRows(connection, sql);
    return rows.map((row: unknown[]) => {
      const cik = String(row[0]);
      return {
        id: cik,
        cik,
        cikName: normalizeSuperinvestorName(row[1] as string | null, cik),
      };
    });
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
