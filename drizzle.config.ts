import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./docker/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.ZERO_UPSTREAM_DB!,
  },
});
