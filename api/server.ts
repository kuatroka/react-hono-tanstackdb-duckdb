import { app } from "./index";
import { duckDbGenerationManager } from "./db/generation-manager";
import spa from "../index.html";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const projectRoot = join(import.meta.dir, "..");
const distDir = join(projectRoot, "dist");
const distIndexHtml = join(distDir, "index.html");
const isProduction = process.env.NODE_ENV === "production";

function resolveDistPath(pathname: string) {
  const normalizedPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(distDir, normalizedPath);
}

function handleProductionRequest(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    return Response.json({ ok: true, service: "fintellectus-tanstackdb" });
  }

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return app.fetch(request);
  }

  if (!existsSync(distIndexHtml)) {
    return new Response("Build output missing. Run `bun run build` first.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  const requestedPath = resolveDistPath(url.pathname.slice(1));
  if (url.pathname !== "/" && existsSync(requestedPath)) {
    return new Response(Bun.file(requestedPath));
  }

  if (url.pathname !== "/" && extname(url.pathname)) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(Bun.file(distIndexHtml));
}

console.log(`API server starting on port ${port}`);

void duckDbGenerationManager.refreshIfNeeded("admin").catch((error) => {
  console.error("Failed to initialize DuckDB generation manager", error);
});

async function shutdownDuckDbManager(signal: string) {
  console.log(`Received ${signal}, draining DuckDB generations`);
  try {
    await duckDbGenerationManager.shutdown();
  } catch (error) {
    console.error("Failed to shutdown DuckDB generation manager", error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  void shutdownDuckDbManager("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdownDuckDbManager("SIGTERM");
});

Bun.serve({
  port,
  ...(isProduction
    ? {
        fetch: handleProductionRequest,
      }
    : {
        routes: {
          "/api": (request: Request) => app.fetch(request),
          "/api/*": (request: Request) => app.fetch(request),
          "/": spa,
          "/*": spa,
        },
      }),
});