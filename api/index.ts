import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { SignJWT } from "jose";
import { duckDbLeaseMiddleware } from "./db/hono-db-middleware";
import { requestTracingMiddleware } from "./middleware-request-tracing";
import dbStatusRoutes from "./routes/db-status";
import drilldownRoutes from "./routes/drilldown";
import searchDuckdbRoutes from "./routes/search-duckdb";
import duckdbInvestorDrilldownRoutes from "./routes/duckdb-investor-drilldown";
import allAssetsActivityRoutes from "./routes/all-assets-activity";
import assetsRoutes from "./routes/assets";
import superinvestorsRoutes from "./routes/superinvestors";
import investorFlowRoutes from "./routes/investor-flow";
import cikQuarterlyRoutes from "./routes/cik-quarterly";
import superinvestorAssetHistoryRoutes from "./routes/superinvestor-asset-history";
import dataFreshnessRoutes from "./routes/data-freshness";
import clientErrorRoutes from "./routes/client-errors";
import { notifyWebAppIncident } from "./telegram-alerts";

export const config = {
  runtime: "edge",
};

export const app = new Hono().basePath("/api");

app.use("*", requestTracingMiddleware);
app.use("*", duckDbLeaseMiddleware);

// Data routes now all come from DuckDB/REST-backed handlers.
app.route("/drilldown", drilldownRoutes);
app.route("/duckdb-search", searchDuckdbRoutes);
app.route("/duckdb-investor-drilldown", duckdbInvestorDrilldownRoutes);
app.route("/all-assets-activity", allAssetsActivityRoutes);
app.route("/assets", assetsRoutes);
app.route("/superinvestors", superinvestorsRoutes);
app.route("/investor-flow", investorFlowRoutes);
app.route("/cik-quarterly", cikQuarterlyRoutes);
app.route("/superinvestor-asset-history", superinvestorAssetHistoryRoutes);
app.route("/data-freshness", dataFreshnessRoutes);
app.route("/db-status", dbStatusRoutes);
app.route("/client-errors", clientErrorRoutes);

app.onError(async (error, c) => {
  await notifyWebAppIncident({
    category: "runtime",
    severity: "error",
    source: "hono",
    title: "Web API runtime error",
    message: error instanceof Error ? error.message : String(error),
    method: c.req.method,
    path: c.req.path,
  }).catch((alertError) => {
    console.warn("[Alerts] failed to send API runtime alert", alertError);
  });

  return c.json({ error: "Internal Server Error" }, 500);
});

// See seed.sql
// In real life you would of course authenticate the user however you like.
const userIDs = [
  "6z7dkeVLNm",
  "ycD76wW4R2",
  "IoQSaxeVO5",
  "WndZWmGkO4",
  "ENzoNm7g4E",
  "dLKecN3ntd",
  "7VoEoJWEwn",
  "enVvyDlBul",
  "9ogaDuDNFx",
];

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function requireJwtSecret() {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return value;
}

const JWT_SECRET = requireJwtSecret();

app.get("/login", async (c) => {
  const jwtPayload = {
    sub: userIDs[randomInt(userIDs.length)],
    iat: Math.floor(Date.now() / 1000),
  };

  const jwt = await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30days")
    .sign(new TextEncoder().encode(JWT_SECRET));

  setCookie(c, "jwt", jwt, {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return c.text("ok");
});
