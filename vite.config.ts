import { defineConfig } from "vite";
import dotenv from "dotenv";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

if (process.env.NODE_ENV === "development") {
  dotenv.config();
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3003,
    proxy: { "/api": "http://localhost:4000" },
  },
  build: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.app.json"],
      ignoreConfigErrors: true,
    }),
    viteReact(),
  ],
});
