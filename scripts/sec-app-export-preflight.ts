export function buildDuckDbLockMessage(duckdbPath: string, blockers: string[]) {
  const lines = [
    `DuckDB source is already open: ${duckdbPath}`,
    "Close these processes before exporting:",
    ...blockers.map((blocker) => `- ${blocker}`),
  ];

  return lines.join("\n");
}
