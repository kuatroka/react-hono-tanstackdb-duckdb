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

    expect(globalNav).toContain("UFuzzyGlobalSearch");
    expect(globalNav).not.toContain("<DuckDBGlobalSearch />");
  });

  test("separates mobile navigation and mobile search into distinct panels while keeping desktop search inline", () => {
    const globalNav = readProjectFile("app/components/global-nav.tsx");

    expect(globalNav).toContain('mode="desktop"');
    expect(globalNav).toContain('mode="mobile-drawer"');
    expect(globalNav).toContain("mobileOpenPanel === \"nav\"");
    expect(globalNav).toContain("mobileOpenPanel === \"search\"");
    expect(globalNav).toContain("Open navigation menu");
    expect(globalNav).toContain("Close navigation menu");
    expect(globalNav).toContain("Open global search");
    expect(globalNav).toContain("Search or jump to…");
    expect(globalNav).toContain("hover:underline underline-offset-4");
    expect(globalNav).toContain("rounded-[calc(var(--radius)-0.125rem)] border border-border/70");
    expect(globalNav).toContain("mt-3 rounded-[var(--mobile-panel-radius)]");
    expect(globalNav).not.toContain("rounded-t-none");
    expect(globalNav).not.toContain("border-t-0");
    expect(globalNav).toContain("md:hidden");
  });

  test("loads the tweakcn live preview bridge script for cross-origin theme syncing", () => {
    const htmlShell = readProjectFile("index.html");

    expect(htmlShell).toContain("https://tweakcn.com/live-preview.min.js");
    expect(htmlShell).toContain("crossorigin=\"anonymous\"");
  });

  test("opts into iPhone safe-area support and shared responsive page wrappers", () => {
    const rootRoute = readProjectFile("app/routes/__root.tsx");
    const pageLayout = readProjectFile("src/components/layout/page-layout.tsx");
    const assetsPage = readProjectFile("src/pages/AssetsTable.tsx");
    const assetDetail = readProjectFile("src/pages/AssetDetail.tsx");

    expect(rootRoute).toContain("viewport-fit=cover");
    expect(pageLayout).toContain("px-[var(--page-gutter)] py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10");
    expect(pageLayout).toContain("max-w-[var(--page-max-width-wide)]");
    expect(assetsPage).toContain("PageLayout");
    expect(assetDetail).toContain("PageLayout");
  });
});
