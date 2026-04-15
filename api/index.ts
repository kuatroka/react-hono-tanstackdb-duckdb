import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { SignJWT } from "jose";
import drilldownRoutes from "./routes/drilldown";
import searchDuckdbRoutes from "./routes/search-duckdb";
import duckdbInvestorDrilldownRoutes from "./routes/duckdb-investor-drilldown";
import allAssetsActivityRoutes from "./routes/all-assets-activity";
import assetsRoutes from "./routes/assets";
import superinvestorsRoutes from "./routes/superinvestors";
import investorFlowRoutes from "./routes/investor-flow";
import cikQuarterlyRoutes from "./routes/cik-quarterly";
import dataFreshnessRoutes from "./routes/data-freshness";

export const config = {
  runtime: "edge",
};

export const app = new Hono().basePath("/api");

// Data routes (formerly served via Zero, now via DuckDB/REST)
app.route("/drilldown", drilldownRoutes);
app.route("/duckdb-search", searchDuckdbRoutes);
app.route("/duckdb-investor-drilldown", duckdbInvestorDrilldownRoutes);
app.route("/all-assets-activity", allAssetsActivityRoutes);
app.route("/assets", assetsRoutes);
app.route("/superinvestors", superinvestorsRoutes);
app.route("/investor-flow", investorFlowRoutes);
app.route("/cik-quarterly", cikQuarterlyRoutes);
app.route("/data-freshness", dataFreshnessRoutes);

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

// JWT secret - falls back to a default for development
const JWT_SECRET = process.env.ZERO_AUTH_SECRET || process.env.JWT_SECRET || "dev-secret";

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
