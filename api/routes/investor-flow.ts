
import { Hono } from "hono";
import { getInvestorFlow } from "../repositories/investor-flow-repository";

const investorFlowRoutes = new Hono();

investorFlowRoutes.get("/", async (c) => {
    const tickerRaw = (c.req.query("ticker") || "").trim();

    if (!tickerRaw) {
        return c.json({ error: "ticker is required" }, 400);
    }

    const ticker = tickerRaw.toUpperCase();

    try {
        const rows = await getInvestorFlow(c, ticker);

        return c.json({
            ticker,
            count: rows.length,
            rows,
        });
    } catch (error) {
        console.error("[Investor Flow] Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Query failed", details: errorMessage }, 500);
    }
});

export default investorFlowRoutes;
