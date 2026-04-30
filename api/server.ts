import { app } from "./index";
import { buildMetadata, withBuildMetadataHeaders } from "./build-metadata";
import { duckDbGenerationManager } from "./db/generation-manager";
import spa from "../index.html";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const projectRoot = join(import.meta.dir, "..");
const distDir = join(projectRoot, "dist");
const distIndexHtml = join(distDir, "index.html");
const isProduction = process.env.NODE_ENV === "production";
const appVariant = process.env.APP_VARIANT?.trim() || "current";
const hostname = process.env.HOST?.trim() || process.env.API_HOST?.trim() || "0.0.0.0";

function withVariantScript(html: string) {
  return html.replace(
    "<head>",
    `<head><script>globalThis.__APP_VARIANT__=${JSON.stringify(appVariant)}</script>`,
  );
}

function resolveDistPath(pathname: string) {
  const normalizedPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(distDir, normalizedPath);
}

async function handleProductionRequest(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    return withBuildMetadataHeaders(Response.json({
      ok: true,
      ...buildMetadata,
    }));
  }

  if (url.pathname === "/__build") {
    return withBuildMetadataHeaders(Response.json(buildMetadata));
  }

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return withBuildMetadataHeaders(await app.fetch(request));
  }

  if (!existsSync(distIndexHtml)) {
    return withBuildMetadataHeaders(new Response("Build output missing. Run `bun run build` first.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    }));
  }

  const requestedPath = resolveDistPath(url.pathname.slice(1));
  if (url.pathname !== "/" && existsSync(requestedPath)) {
    return withBuildMetadataHeaders(new Response(Bun.file(requestedPath)));
  }

  if (url.pathname !== "/" && extname(url.pathname)) {
    return withBuildMetadataHeaders(new Response("Not Found", { status: 404 }));
  }

  return withBuildMetadataHeaders(new Response(withVariantScript(await Bun.file(distIndexHtml).text()), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
}

console.log(`API server starting on ${hostname}:${port} (${appVariant})`);

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
  hostname,
  port,
  development: isProduction ? false : {
    hmr: true,
    console: true,
  },
  ...(isProduction
    ? {
        fetch: handleProductionRequest,
      }
    : {
        fetch: (request: Request) => app.fetch(request),
        routes: {
          "/api": (request: Request) => app.fetch(request),
          "/api/*": (request: Request) => app.fetch(request),
          "/": spa,
          "/*": spa,
        },
      }),
});