import { describe, expect, test } from "bun:test";

describe("VirtualDataTable", () => {
  test("normalizes search so filtering only activates after two typed characters", async () => {
    const source = await Bun.file(new URL("./VirtualDataTable.tsx", import.meta.url)).text();

    expect(source).toContain("const DEFAULT_MIN_SEARCH_CHARACTERS = 2;");
    expect(source).toContain("minimumSearchCharacters = DEFAULT_MIN_SEARCH_CHARACTERS");
    expect(source).toContain("const normalizedSearch = useMemo(() => {");
    expect(source).toContain("return committedSearch.length >= minimumSearchCharacters ? committedSearch : '';");
    expect(source).toContain("const nextCommittedSearch = searchValue.trim();");
    expect(source).toContain("setDraftSearchValue((current) => current === searchValue ? current : searchValue);");
    expect(source).toContain("setCommittedSearch((current) => current === nextCommittedSearch ? current : nextCommittedSearch);");
    expect(source).toContain("setCommittedSearch(draftSearchValue.trim())");
    expect(source).toContain("onSearchChange?.(normalizedSearch);");
    expect(source).not.toContain("onSearchChange?.(value);");
    expect(source).toContain("if (!normalizedSearch) {");
    expect(source).toContain("rows: data,");
    expect(source).toContain("searchStrategy = 'includes'");
    expect(source).toContain("const ufuzzyRef = useRef(new UFuzzy(UFUZZY_OPTIONS));");
    expect(source).toContain("const previousUFuzzyFilterRef = useRef<UFuzzyPreviousFilter>({ query: '', idxs: null, haystackSize: 0 });");
    expect(source).toContain("if (searchStrategy === 'ufuzzy') {");
    expect(source).toContain("runUFuzzyIndexSearch(");
    expect(source).toContain("rerankUFuzzyTableRows(");
    expect(source).toContain("ufuzzyRanking?: UFuzzyTableRankingConfig<T>;");
    expect(source).toContain("const hasExplicitSort = sortColumn !== defaultSortColumn || sortDirection !== defaultSortDirection;");
    expect(source).toContain("if (!shouldReorderRows || (hasSearch && searchStrategy === 'ufuzzy' && !hasExplicitSort)) {");
    expect(source).toContain("enabled: Boolean(latencySource && normalizedSearch)");
    expect(source).toContain("const [revealedRowCount, setRevealedRowCount] = useState(() => Math.min(data.length, clientPageSize));");
    expect(source).toContain("return orderedData.slice(0, revealedRowCount);");
    expect(source).toContain("setRevealedRowCount((current) => Math.min(current + clientPageSize, orderedData.length));");
  });

  test("memoizes the search toggle and sortable header chrome so scrolling only rerenders the virtual body", async () => {
    const source = await Bun.file(new URL("./VirtualDataTable.tsx", import.meta.url)).text();

    expect(source).toContain("const SearchToggleButton = memo(function SearchToggleButton");
    expect(source).toContain("const SortHeaderButton = memo(function SortHeaderButton");
    expect(source).toContain("const SortIndicator = memo(function SortIndicator");
  });

  test("uses global search chrome for expanded table search inputs without a second adjacent icon", async () => {
    const source = await Bun.file(new URL("./VirtualDataTable.tsx", import.meta.url)).text();

    expect(source).toContain("const SEARCH_FIELD_CONTAINER_CLASS_NAME = 'w-full min-w-0 sm:w-[18rem] lg:w-[20rem] xl:w-[22rem]';");
    expect(source).toContain("const SEARCH_FIELD_ICON_CLASS_NAME = 'pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground';");
    expect(source).toContain("const SEARCH_FIELD_INPUT_CLASS_NAME = 'h-10 w-full rounded-md border-border/80 bg-background/90 pl-10 pr-4 text-sm shadow-sm';");
    expect(source).toContain("<Search className={SEARCH_FIELD_ICON_CLASS_NAME} />");
    expect(source).toContain("className={cn(SEARCH_FIELD_INPUT_CLASS_NAME, inputClassName)}");
    expect(source).toContain(") : (\n          <SearchToggleButton isExpanded={isExpanded} onToggle={handleToggle} />");
  });

  test("supports explicit row click handlers in addition to anchor activation", async () => {
    const source = await Bun.file(new URL("./VirtualDataTable.tsx", import.meta.url)).text();

    expect(source).toContain("onRowClick?: (row: T) => void;");
    expect(source).toContain("const triggerRowClick = useCallback((row: T) => {");
    expect(source).toContain("onClick={() => triggerRowClick(row)}");
    expect(source).toContain("if (event.key === 'Enter') {");
  });
});
