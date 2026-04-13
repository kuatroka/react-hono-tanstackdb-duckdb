import type { DuckDbConnection } from "./types";

export async function runAndGetRows(connection: DuckDbConnection, sql: string) {
  const reader = await connection.runAndReadAll(sql);
  return reader.getRows();
}

export async function runPreparedAndGetRows(statement: { runAndReadAll: () => Promise<{ getRows: () => unknown[][] }> }) {
  const reader = await statement.runAndReadAll();
  return reader.getRows();
}
