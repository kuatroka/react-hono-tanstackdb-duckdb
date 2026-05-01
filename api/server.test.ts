import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");
const distDir = join(projectRoot, "dist");
const distIndexHtml = join(distDir, "index.html");
const distAssetPath = join(distDir, "assets", "app.js");
const productionPort = 4311;
const developmentPort = 4312;
const productionBaseUrl = `http://127.0.0.1:${productionPort}`;
const developmentBaseUrl = `http://127.0.0.1:${developmentPort}`;
const testBuildMetadata = {
  APP_VERSION: "9.9.9-test",
  APP_GIT_COMMIT: "abcdef1234567890abcdef1234567890abcdef12",
  APP_PROD_TAG: "PROD-V-9.9.9-test-20260420-000000",
  APP_DEPLOYED_AT: "2026-04-20T00:00:00Z",
};

let productionServerProcess: Bun.Subprocess;
let developmentServerProcess: Bun.Subprocess;

async function waitForServer(url: string, timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      continue;
    }

    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for server at ${url}`);
}

function startServer(port: number, nodeEnv: "development" | "production") {
  return Bun.spawn(["bun", "api/server.ts"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ...testBuildMetadata,
      API_PORT: String(port),
      NODE_ENV: nodeEnv,
      DUCKDB_PATH: process.env.DUCKDB_PATH ?? '/tmp/test.duckdb',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret',
    },
    stderr: "inherit",
    stdout: "inherit",
  });
}

describe("bun native production server smoke tests", () => {
  beforeAll(async () => {
    rmSync(distDir, { force: true, recursive: true });

    productionServerProcess = startServer(productionPort, "production");

    await waitForServer(`${productionBaseUrl}/api/login`);
  });

  afterAll(async () => {
    productionServerProcess.kill();
    await productionServerProcess.exited;
    rmSync(distDir, { force: true, recursive: true });
  });

  afterEach(() => {
    rmSync(distDir, { force: true, recursive: true });
  });

  test("routes /api requests to the Hono app", async () => {
    const response = await fetch(`${productionBaseUrl}/api/login`);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("jwt=");
    expect(await response.text()).toBe("ok");
  });

  test("serves a lightweight health endpoint in production", async () => {
    const response = await fetch(`${productionBaseUrl}/healthz`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-app-version")).toBe(testBuildMetadata.APP_VERSION);
    expect(response.headers.get("x-git-commit")).toBe(testBuildMetadata.APP_GIT_COMMIT);
    expect(response.headers.get("x-prod-tag")).toBe(testBuildMetadata.APP_PROD_TAG);
    expect(response.headers.get("x-deployed-at")).toBe(testBuildMetadata.APP_DEPLOYED_AT);
    expect(body).toEqual({
      ok: true,
      service: "react-hono-tanstackdb-duckdb",
      appVersion: testBuildMetadata.APP_VERSION,
      gitCommit: testBuildMetadata.APP_GIT_COMMIT,
      gitCommitShort: "abcdef1",
      prodTag: testBuildMetadata.APP_PROD_TAG,
      deployedAt: testBuildMetadata.APP_DEPLOYED_AT,
    });
  });

  test("exposes build metadata on a dedicated production endpoint", async () => {
    const response = await fetch(`${productionBaseUrl}/__build`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      service: "react-hono-tanstackdb-duckdb",
      appVersion: testBuildMetadata.APP_VERSION,
      gitCommit: testBuildMetadata.APP_GIT_COMMIT,
      gitCommitShort: "abcdef1",
      prodTag: testBuildMetadata.APP_PROD_TAG,
      deployedAt: testBuildMetadata.APP_DEPLOYED_AT,
    });
  });

  test("falls back to index.html for client routes", async () => {
    const response = await fetch(`${productionBaseUrl}/dashboard`);

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("Build output missing");
  });

  test("serves built assets from dist when the file exists", async () => {
    mkdirSync(join(distDir, "assets"), { recursive: true });
    writeFileSync(distIndexHtml, "<!doctype html><html><body>built app</body></html>");
    writeFileSync(distAssetPath, 'console.log("built asset");');

    const response = await fetch(`${productionBaseUrl}/assets/app.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(await response.text()).toBe(readFileSync(distAssetPath, "utf8"));
  });
});

describe("bun native development server smoke tests", () => {
  beforeAll(async () => {
    const cssBuild = Bun.spawnSync(["bun", "scripts/build-css.ts"], {
      cwd: projectRoot,
      env: process.env,
      stderr: "inherit",
      stdout: "inherit",
    });

    expect(cssBuild.exitCode).toBe(0);

    developmentServerProcess = startServer(developmentPort, "development");
    await waitForServer(`${developmentBaseUrl}/api/login`);
  });

  afterAll(async () => {
    developmentServerProcess.kill();
    await developmentServerProcess.exited;
  });

  test("serves the SPA shell for client routes in development", async () => {
    const response = await fetch(`${developmentBaseUrl}/dashboard`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('<div id="root"></div>');
  });

  test("serves Bun-bundled development module scripts with JavaScript MIME types", async () => {
    const shellResponse = await fetch(`${developmentBaseUrl}/assets`);
    const shell = await shellResponse.text();
    const scriptPath = shell.match(/<script type="module"[^>]+src="([^"]+)"/)?.[1];

    expect(scriptPath).toStartWith("/_bun/client/");

    const response = await fetch(`${developmentBaseUrl}${scriptPath}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(await response.text()).not.toContain("<!doctype html>");
  });
});
