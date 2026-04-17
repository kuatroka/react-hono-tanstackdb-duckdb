import type { DuckDbConnection } from "@duckdb/node-api";
import { getDuckDbLease, type DuckDbLeaseContext } from "../db/lease-context";

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

export async function listAssets(c: DuckDbLeaseContext, params: ListAssetsParams) {
  const lease = getDuckDbLease(c);
  return lease.run("assets.list", async (connection: DuckDbConnection) => {
    const sortColumn = params.sort === "asset" ? "asset" : params.sort === "cusip" ? "cusip" : "asset_name";
    const sortDirection = params.direction === "desc" ? "DESC" : "ASC";
    const query = (params.search ?? "").trim();
    const hasSearch = query.length > 0;

    const sql = `
      SELECT
        asset,
        asset_name as "assetName",
        cusip
      FROM assets
      ${hasSearch ? "WHERE LOWER(asset) LIKE ? OR LOWER(asset_name) LIKE ? OR LOWER(COALESCE(cusip, '')) LIKE ?" : ""}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const stmt = await connection.prepare(sql);
    let bindIndex = 1;
    if (hasSearch) {
      const pattern = `%${query.toLowerCase()}%`;
      stmt.bindVarchar(bindIndex++, pattern);
      stmt.bindVarchar(bindIndex++, pattern);
      stmt.bindVarchar(bindIndex++, pattern);
    }
    stmt.bindInteger(bindIndex++, params.limit);
    stmt.bindInteger(bindIndex++, params.offset);

    const reader = await stmt.runAndReadAll();
    const rows = reader.getRows();
    return rows.map((row: unknown[], index: number) => ({
      id: `${row[0]}-${row[2] || params.offset + index}`,
      asset: row[0] as string,
      assetName: row[1] as string,
      cusip: row[2] as string | null,
    })) satisfies AssetRow[];
  });
}

export async function getAssetByCode(c: DuckDbLeaseContext, params: { code: string; cusip?: string }) {
  const lease = getDuckDbLease(c);
  return lease.run("assets.getByCode", async (connection: DuckDbConnection) => {
    const sql = params.cusip
      ? `
      SELECT
        asset,
        asset_name as "assetName",
        cusip
      FROM assets
      WHERE asset = ? AND cusip = ?
      LIMIT 1
    `
      : `
      SELECT
        asset,
        asset_name as "assetName",
        cusip
      FROM assets
      WHERE asset = ?
      ORDER BY asset_name ASC
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
