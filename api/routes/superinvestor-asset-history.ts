import { Hono } from "hono";
import { getSuperinvestorAssetHistory } from "../repositories/superinvestor-asset-history-repository";

const superinvestorAssetHistoryRoutes = new Hono();

superinvestorAssetHistoryRoutes.get("/", async (c) => {
  const tickerRaw = (c.req.query("ticker") || "").trim();
  const cusipRaw = (c.req.query("cusip") || "").trim();
  const cikRaw = (c.req.query("cik") || "").trim();

  if (!tickerRaw || !cusipRaw || !cikRaw) {
    return c.json({ error: "ticker, cusip, and cik are required" }, 400);
  }

  const ticker = tickerRaw.toUpperCase();

  try {
    const startTime = performance.now();
    const rows = await getSuperinvestorAssetHistory(c, {
      ticker,
      cusip: cusipRaw,
      cik: cikRaw,
    });

    return c.json({
      ticker,
      cusip: cusipRaw,
      cik: cikRaw,
      count: rows.length,
      queryTimeMs: Math.round(performance.now() - startTime),
      complete: true,
      rows,
    });
  } catch (error) {
    console.error("[Superinvestor Asset History] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Query failed", details: errorMessage }, 500);
  }
});

export default superinvestorAssetHistoryRoutes;
