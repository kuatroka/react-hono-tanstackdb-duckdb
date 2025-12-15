import { defineConfig } from "vite";
import dotenv from "dotenv";
import path from "path";

if (process.env.NODE_ENV === "development") {
  dotenv.config();
}

export default defineConfig({
  server: {
    port: 3001,
    proxy: { "/api": "http://localhost:4001" },
  },
  build: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
 
  ],
});
