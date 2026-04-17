import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("bun native runtime config", () => {
  test("uses Bun-native dev and build scripts instead of database/bootstrap scripts", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts["dev:api"]).toBe("bun --hot api/server.ts");
    expect(packageJson.scripts["dev:ui"]).toBe("bun run dev:css");
    expect(packageJson.scripts["dev"]).toContain("bun run dev:css");
    expect(packageJson.scripts["dev"]).toContain("bun run dev:api");
    expect(packageJson.scripts["build:css"]).toBe("bun scripts/build-css.ts");
    expect(packageJson.scripts["build:html"]).toBe("bun build ./index.html --outdir ./dist && bun scripts/fix-built-html.ts");
    expect(packageJson.scripts["build"]).toBe("bun run build:css && bun run build:html");
    expect(packageJson.scripts["dev:db-up"]).toBeUndefined();
    expect(packageJson.scripts["dev:db-down"]).toBeUndefined();
    expect(packageJson.scripts["dev:all"]).toBeUndefined();
    expect(packageJson.scripts["db:generate"]).toBeUndefined();
    expect(packageJson.scripts["db:migrate"]).toBeUndefined();
    expect(packageJson.scripts["db:sync"]).toBeUndefined();
    expect(packageJson.dependencies?.postgres).toBeUndefined();
    expect(packageJson.dependencies?.["drizzle-orm"]).toBeUndefined();
    expect(packageJson.devDependencies?.["drizzle-kit"]).toBeUndefined();
  });

  test("serves the SPA shell from Bun and relies on compiled CSS", () => {
    const server = readProjectFile("api/server.ts");
    const html = readProjectFile("index.html");
    const mainEntrypoint = readProjectFile("src/main.tsx");
    const appCss = readProjectFile("src/index.css");

    expect(server).toContain('import spa from "../index.html";');
    expect(server).toContain("routes:");
    expect(html).toContain('href="./index.compiled.css"');
    expect(mainEntrypoint).not.toContain('import "./index.css";');
    expect(appCss).toContain("font-family: var(--font-sans);");
  });

  test("guards frontend env access so Bun runtime does not crash in the browser", () => {
    const rootRoute = readProjectFile("app/routes/__root.tsx");
    const mainEntrypoint = readProjectFile("src/main.tsx");
    const runtimeEnv = readProjectFile("src/lib/runtime-env.ts");

    expect(rootRoute).toContain("import.meta.env?.VITE_PUBLIC_SERVER");
    expect(rootRoute).toContain("http://localhost:4000");
    expect(mainEntrypoint).toContain("shouldEnableReactScan");
    expect(mainEntrypoint).toContain("globalThis.location?.hostname");
    expect(runtimeEnv).toContain('new Set(["localhost", "127.0.0.1", "::1", "[::1]"])');
  });

  test("defines the app-only VPS deployment contract for the sslip.io web app", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const compose = readProjectFile("infra/prod/docker-compose.yml");
    const envExample = readProjectFile("infra/prod/.env.example");
    const caddyTemplate = readProjectFile("infra/prod/Caddyfile.template");

    expect(dockerfile).toContain("FROM oven/bun");
    expect(compose).toContain("services:");
    expect(compose).toContain("app:");
    expect(compose).toContain("APP_PUBLIC_URL");
    expect(compose).toContain("JWT_SECRET");
    expect(compose).toContain("DUCKDB_PATH");
    expect(compose).toContain("SEARCH_INDEX_PATH");
    expect(compose).not.toContain("postgresql://user:password@postgres:5432/postgres");
    expect(compose).not.toContain("POSTGRES_NETWORK");
    expect(compose).not.toContain("networks:");
    expect(envExample).toContain("fintellectus-tanstackdb.206.168.212.173.sslip.io");
    expect(envExample).toContain("CADDY_SITES_HOST_PATH=/opt/dev/erudio_app/caddy/sites");
    expect(envExample).toContain("JWT_SECRET=secretkey");
    expect(envExample).not.toContain("POSTGRES_NETWORK=");
    expect(caddyTemplate).toContain("__APP_DOMAIN__");
  });
});
