import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("app shell branding", () => {
  test("uses the TanStack DB app title in the browser tab", () => {
    const rootRoute = readProjectFile("app/routes/__root.tsx");

    expect(rootRoute).toContain('{ title: "fintellectus (Tanstack DB)" }');
  });

  test("uses the TanStack DB title on the homepage and in the global menu", () => {
    const homeRoute = readProjectFile("app/routes/_layout/index.tsx");
    const globalNav = readProjectFile("app/components/global-nav.tsx");

    expect(homeRoute).toContain("Welcome to fintellectus (Tanstack DB)");
    expect(globalNav).toContain("fintellectus (Tanstack DB)");
  });
});

describe("global navigation layout", () => {
  test("keeps the global menu sticky at the top", () => {
    const globalNav = readProjectFile("app/components/global-nav.tsx");

    expect(globalNav).toContain("sticky top-0");
  });

  test("renders the production uFuzzy-backed global search box", () => {
    const globalNav = readProjectFile("app/components/global-nav.tsx");

    expect(globalNav).toContain("<UFuzzyGlobalSearch />");
    expect(globalNav).not.toContain("<DuckDBGlobalSearch />");
  });
});
