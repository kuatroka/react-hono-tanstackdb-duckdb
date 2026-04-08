import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("bun native runtime config", () => {
  test("uses Bun-native dev and build scripts instead of Vite entrypoints", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["dev:api"]).toBe("bun --hot api/server.ts");
    expect(packageJson.scripts["dev:ui"]).toBe("bun run dev:css");
    expect(packageJson.scripts["dev"]).toContain("bun run dev:css");
    expect(packageJson.scripts["dev"]).toContain("bun run dev:api");
    expect(packageJson.scripts["build:css"]).toBe("bun scripts/build-css.ts");
    expect(packageJson.scripts["build:html"]).toBe("bun build ./index.html --outdir ./dist && bun scripts/fix-built-html.ts");
    expect(packageJson.scripts["build"]).toBe("bun run build:css && bun run build:html");
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

    expect(rootRoute).toContain("import.meta.env?.VITE_PUBLIC_SERVER");
    expect(mainEntrypoint).toContain("import.meta.env?.DEV");
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
    expect(compose).toContain("external: true");
    expect(compose).not.toContain("container_name: ${POSTGRES");
    expect(compose).not.toContain("zero-cache:");
    expect(envExample).toContain("fintellectus-tanstackdb.206.168.212.173.sslip.io");
    expect(envExample).toContain("CADDY_SITES_HOST_PATH=/opt/dev/erudio_app/caddy/sites");
    expect(envExample).not.toContain("fintellectus-zero.206.168.212.173.sslip.io");
    expect(caddyTemplate).toContain("__APP_DOMAIN__");
    expect(caddyTemplate).not.toContain("__ZERO_DOMAIN__");
  });
});
