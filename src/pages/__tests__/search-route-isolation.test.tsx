import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..", "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("route search isolation", () => {
  test("global search results consume a local shared type instead of importing from the parent component", () => {
    const globalSearch = readProjectFile("components/DuckDBGlobalSearch.tsx");
    const globalSearchResults = readProjectFile("components/global-search/GlobalSearchResults.tsx");

    expect(globalSearchResults).not.toContain('from "@/components/DuckDBGlobalSearch"');
    expect(globalSearchResults).toContain('from "@/components/global-search/search-result"');
    expect(globalSearch).toContain('from "@/components/global-search/search-result"');
    expect(globalSearch).not.toContain("export interface SearchResult");
  });

  test("assets route trims URL search state and forwards normalized search updates", () => {
    const source = readProjectFile("pages/AssetsTable.tsx");

    expect(source).toContain("const trimmedSearch = (searchParams.search ?? '').trim();");
    expect(source).toContain("await assetsCollection.preload()");
    expect(source).toContain("Array.from(assetsCollection.entries()).map(([, value]) => value)");
    expect(source).toContain("to: '/assets'");
    expect(source).toContain("search: { search: value.trim() || undefined }");
    expect(source).toContain("searchPlaceholder=\"Search assets...\"");
    expect(source).toContain("defaultSortColumn=\"assetName\"");
  });

  test("superinvestors route trims URL search state and forwards normalized search updates", () => {
    const source = readProjectFile("pages/SuperinvestorsTable.tsx");

    expect(source).toContain('const trimmedSearch = (searchParams.search ?? "").trim();');
    expect(source).toContain("await superinvestorsCollection.preload()");
    expect(source).toContain("Array.from(superinvestorsCollection.entries()).map(([, value]) => value)");
    expect(source).toContain('to: "/superinvestors"');
    expect(source).toContain('search: { search: value.trim() || undefined }');
    expect(source).toContain('searchPlaceholder="Search superinvestors..."');
    expect(source).toContain('defaultSortColumn="cikName"');
  });
});
