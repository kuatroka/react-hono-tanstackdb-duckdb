import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";
import { runPreparedAndGetRows } from "../db/query-runner";

export interface AssetRow {
  id: string;
  asset: string;
  assetName: string;
  cusip: string | null;
}

export interface ListAssetsParams {
  limit: number;
  offset: number;
  search?: string;
  sort?: "asset" | "assetName" | "cusip";
  direction?: "asc" | "desc";
}

export interface ListAssetsResult {
  rows: AssetRow[];
  totalCount: number;
  limitApplied: number;
  offset: number;
  complete: boolean;
}

const ASSET_DISPLAY_NAME_SQL = "COALESCE(NULLIF(TRIM(cusip_md.cusip_ticker_name), ''), NULLIF(TRIM(assets.asset_name), ''), assets.asset)";

export async function listAssets(c: DuckDbLeaseContext, params: ListAssetsParams): Promise<ListAssetsResult> {
  const lease = getDuckDbLease(c);
  return lease.run("assets.list", async (connection: DuckDbConnection) => {
    const sortColumn = params.sort === "asset" ? "assets.asset" : params.sort === "cusip" ? "assets.cusip" : ASSET_DISPLAY_NAME_SQL;
    const sortDirection = params.direction === "desc" ? "DESC" : "ASC";
    const query = (params.search ?? "").trim();
    const hasSearch = query.length > 0;
    const whereClause = hasSearch
      ? `WHERE LOWER(assets.asset) LIKE ? OR LOWER(${ASSET_DISPLAY_NAME_SQL}) LIKE ? OR LOWER(COALESCE(assets.cusip, '')) LIKE ?`
      : "";

    const countStmt = await connection.prepare(`
      SELECT COUNT(*)
      FROM assets
      LEFT JOIN cusip_md ON assets.cusip = cusip_md.cusip
      ${whereClause}
    `);

    let bindIndex = 1;
    if (hasSearch) {
      const pattern = `%${query.toLowerCase()}%`;
      countStmt.bindVarchar(bindIndex++, pattern);
      countStmt.bindVarchar(bindIndex++, pattern);
      countStmt.bindVarchar(bindIndex++, pattern);
    }

    const countRows = await runPreparedAndGetRows(countStmt);
    const totalCount = Number(countRows[0]?.[0]) || 0;

    const stmt = await connection.prepare(`
      SELECT
        assets.asset,
        ${ASSET_DISPLAY_NAME_SQL} as "assetName",
        assets.cusip
      FROM assets
      LEFT JOIN cusip_md ON assets.cusip = cusip_md.cusip
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}, assets.asset ASC, COALESCE(assets.cusip, '') ASC
      LIMIT ? OFFSET ?
    `);

    bindIndex = 1;
    if (hasSearch) {
      const pattern = `%${query.toLowerCase()}%`;
      stmt.bindVarchar(bindIndex++, pattern);
      stmt.bindVarchar(bindIndex++, pattern);
      stmt.bindVarchar(bindIndex++, pattern);
    }
    stmt.bindInteger(bindIndex++, params.limit);
    stmt.bindInteger(bindIndex++, params.offset);

    const rows = await runPreparedAndGetRows(stmt);
    const assetRows = rows.map((row: unknown[]) => ({
      id: `${row[0]}-${row[2] || "none"}`,
      asset: row[0] as string,
      assetName: row[1] as string,
      cusip: row[2] as string | null,
    })) satisfies AssetRow[];

    return {
      rows: assetRows,
      totalCount,
      limitApplied: params.limit,
      offset: params.offset,
      complete: params.offset + assetRows.length >= totalCount,
    };
  });
}

export async function getAssetByCode(c: DuckDbLeaseContext, params: { code: string; cusip?: string }) {
  const lease = getDuckDbLease(c);
  return lease.run("assets.getByCode", async (connection: DuckDbConnection) => {
    const sql = params.cusip
      ? `
      SELECT
        assets.asset,
        ${ASSET_DISPLAY_NAME_SQL} as "assetName",
        assets.cusip
      FROM assets
      LEFT JOIN cusip_md ON assets.cusip = cusip_md.cusip
      WHERE assets.asset = ? AND assets.cusip = ?
      LIMIT 1
    `
      : `
      SELECT
        assets.asset,
        ${ASSET_DISPLAY_NAME_SQL} as "assetName",
        assets.cusip
      FROM assets
      LEFT JOIN cusip_md ON assets.cusip = cusip_md.cusip
      WHERE assets.asset = ?
      ORDER BY ${ASSET_DISPLAY_NAME_SQL} ASC
      LIMIT 1
    `;

    const stmt = await connection.prepare(sql);
    stmt.bindVarchar(1, params.code);
    if (params.cusip) {
      stmt.bindVarchar(2, params.cusip);
    }

    const reader = await stmt.runAndReadAll();
    const rows = reader.getRows();
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: `${row[0]}-${row[2] || "none"}`,
      asset: row[0] as string,
      assetName: row[1] as string,
      cusip: row[2] as string | null,
    } satisfies AssetRow;
  });
}
