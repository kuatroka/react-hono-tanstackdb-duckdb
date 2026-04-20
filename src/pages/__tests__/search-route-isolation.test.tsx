import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..", "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("route search isolation", () => {
  test("global search results consume a local shared type instead of importing from the parent component", () => {
    const globalSearch = readProjectFile("components/UFuzzyGlobalSearch.tsx");
    const globalSearchResults = readProjectFile("components/global-search/GlobalSearchResults.tsx");

    expect(globalSearchResults).not.toContain('from "@/components/UFuzzyGlobalSearch"');
    expect(globalSearchResults).toContain('from "@/components/global-search/search-result"');
    expect(globalSearch).toContain("GlobalSearchResults");
    expect(globalSearch).not.toContain("export interface SearchResult");
  });

  test("assets route keeps table search local so typing does not fan out through router state", () => {
    const source = readProjectFile("pages/AssetsTable.tsx");

    expect(source).toContain("await assetsCollection.preload()");
    expect(source).toContain("clientPageSize={100}");
    expect(source).not.toContain("useSearch");
    expect(source).not.toContain("useNavigate");
    expect(source).toContain("searchPlaceholder=\"Search assets...\"");
    expect(source).toContain("defaultSortColumn={DEFAULT_SORT_COLUMN}");
  });

  test("superinvestors route keeps table search inside the virtual table instead of mutating router state", () => {
    const source = readProjectFile("pages/SuperinvestorsTable.tsx");

    expect(source).toContain("await superinvestorsCollection.preload()");
    expect(source).toContain("Array.from(superinvestorsCollection.entries()).map(([, value]) => value)");
    expect(source).toContain("clientPageSize={100}");
    expect(source).not.toContain("useSearch");
    expect(source).not.toContain("useNavigate");
    expect(source).not.toContain("onSearchChange=");
    expect(source).toContain('searchPlaceholder="Search superinvestors..."');
    expect(source).toContain('defaultSortColumn="cikName"');
  });
});
