import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("performance contracts", () => {
  test("react-scan script uses an explicit https URL so it loads in local dev", () => {
    const html = readProjectFile("index.html");

    expect(html).toContain('src="https://unpkg.com/react-scan/dist/auto.global.js"');
  });

  test("global search keeps transient query state local instead of rewriting router search params on each keystroke", () => {
    const globalSearch = readProjectFile("src/components/GlobalSearch.tsx");

    expect(globalSearch).not.toContain("useSearchParams");
    expect(globalSearch).not.toContain("setSearchParams");
    expect(globalSearch).not.toContain("useNavigate");
    expect(globalSearch).not.toContain('params.set("q"');
    expect(globalSearch).not.toContain('params.delete("q"');
  });

  test("global search isolates the input in its own memoized component", () => {
    const globalSearch = readProjectFile("src/components/GlobalSearch.tsx");

    expect(globalSearch).toContain("memo(function GlobalSearchInput");
    expect(globalSearch).toContain('const [inputValue, setInputValue] = useState("")');
    expect(globalSearch).toContain("clearSignal");
    expect(globalSearch).not.toContain("const deferredQuery = useDeferredValue(query)");
  });

  test("global search keeps query and keyboard callbacks in refs so search results do not rerender the input", () => {
    const globalSearch = readProjectFile("src/components/GlobalSearch.tsx");

    expect(globalSearch).toContain("const onQueryCommitRef = useRef(onQueryCommit)");
    expect(globalSearch).toContain("const onKeyActionRef = useRef(onKeyAction)");
    expect(globalSearch).toContain("setTimeout(() => {");
  });

  test("global search does not keep idle zero search subscriptions alive when the dropdown is closed", () => {
    const globalSearch = readProjectFile("src/components/GlobalSearch.tsx");

    expect(globalSearch).not.toContain('queries.searchesByCode("", 0)');
    expect(globalSearch).not.toContain('queries.searchesByName("", 0)');
    expect(globalSearch).toContain("enabled: shouldSearch");
  });

  test("global search keeps zero preloading inside the mounted results list instead of the idle navbar shell", () => {
    const globalSearch = readProjectFile("src/components/GlobalSearch.tsx");
    const globalSearchShell = globalSearch.split('export const GlobalSearch = memo(function GlobalSearch() {')[1] ?? "";

    expect(globalSearch).toContain("memo(function GlobalSearchResultsList");
    expect(globalSearchShell).not.toContain("useZero<Schema>()");
  });

  test("global nav isolates route-aware link state instead of subscribing the whole navbar to location changes", () => {
    const globalNav = readProjectFile("src/components/GlobalNav.tsx");

    expect(globalNav).not.toContain("useLocation");
    expect(globalNav).toContain("memo(function GlobalNavLink");
    expect(globalNav).toContain("<GlobalNavLink");
  });

  test("global nav avoids react-router Link subscriptions for the sticky shell and brand/profile anchors", () => {
    const globalNav = readProjectFile("src/components/GlobalNav.tsx");

    expect(globalNav).not.toContain("import { Link");
    expect(globalNav).not.toContain("<Link");
    expect(globalNav).toContain("memo(function RouterAnchor");
    expect(globalNav).toContain("navigateTo(to)");
  });

  test("router navigation is bridged once so global search can navigate without rerendering on route changes", () => {
    const main = readProjectFile("src/main.tsx");
    const navigationBridge = readProjectFile("src/lib/navigation.ts");

    expect(main).toContain("<RouterNavigationBridge />");
    expect(navigationBridge).toContain("useNavigate");
    expect(navigationBridge).toContain("export function navigateTo");
  });

  test("investor activity echarts chart uses a stable manual echarts lifecycle", () => {
    const chartSource = readProjectFile("src/components/charts/InvestorActivityEchartsChart.tsx");

    expect(chartSource).not.toContain("echarts-for-react");
    expect(chartSource).toContain("echarts.init");
    expect(chartSource).toContain("animation: false");
    expect(chartSource).toContain("ResizeObserver");
  });

  test("investor activity echarts chart initializes directly from the live container size instead of waiting on separate size state", () => {
    const chartSource = readProjectFile("src/components/charts/InvestorActivityEchartsChart.tsx");

    expect(chartSource).not.toContain("const [chartSize, setChartSize]");
    expect(chartSource).not.toContain("!chartSize");
    expect(chartSource).toContain("const syncChart = () =>");
    expect(chartSource).toContain("container.clientWidth || container.getBoundingClientRect().width");
    expect(chartSource).toContain("container.clientHeight || container.getBoundingClientRect().height");
  });

  test("assets and superinvestors page searches keep transient input out of the router state", () => {
    const assetsTable = readProjectFile("src/pages/AssetsTable.tsx");
    const superinvestorsTable = readProjectFile("src/pages/SuperinvestorsTable.tsx");

    expect(assetsTable).not.toContain("get('search')");
    expect(assetsTable).not.toContain("set('search'");
    expect(superinvestorsTable).not.toContain("get('search')");
    expect(superinvestorsTable).not.toContain("set('search'");
  });

  test("data table debounces external search notifications to localize keystroke rerenders", () => {
    const dataTable = readProjectFile("src/components/DataTable.tsx");

    expect(dataTable).toContain("searchDebounceMs");
    expect(dataTable).toContain("setTimeout(() => {");
    expect(dataTable).toContain("onQueryCommit(inputValue)");
    expect(dataTable).not.toContain("handleSearch = (value: string)");
  });

  test("data table isolates the search input in its own memoized component", () => {
    const dataTable = readProjectFile("src/components/DataTable.tsx");

    expect(dataTable).toContain("memo(function DataTableSearchInput");
    expect(dataTable).toContain("const [inputValue, setInputValue]");
    expect(dataTable).toContain("onQueryCommit(inputValue)");
    expect(dataTable).toContain("<DataTableSearchInput");
  });

  test("data table keeps search callbacks in refs so parent table updates do not rerender the memoized search input", () => {
    const dataTable = readProjectFile("src/components/DataTable.tsx");

    expect(dataTable).toContain("const onSearchChangeRef = useRef(onSearchChange)");
    expect(dataTable).toContain("const onPageChangeRef = useRef(onPageChange)");
  });

  test("data table is memoized so route-level state changes do not rerender the whole table", () => {
    const dataTable = readProjectFile("src/components/DataTable.tsx");

    expect(dataTable).toContain("memo(DataTableInner)");
    expect(dataTable).toContain("MemoizedDataTable.displayName = 'DataTable'");
  });

  test("assets and superinvestors pages delegate virtualized search and sorting to a zero-virtual table instead of owning paginated table state", () => {
    const assetsTable = readProjectFile("src/pages/AssetsTable.tsx");
    const superinvestorsTable = readProjectFile("src/pages/SuperinvestorsTable.tsx");

    expect(assetsTable).toContain("ZeroVirtualDataTable");
    expect(superinvestorsTable).toContain("ZeroVirtualDataTable");
    expect(assetsTable).not.toContain("<DataTable");
    expect(superinvestorsTable).not.toContain("<DataTable");
    expect(assetsTable).not.toContain("const [searchTerm, setSearchTerm]");
    expect(superinvestorsTable).not.toContain("const [searchTerm, setSearchTerm]");
    expect(assetsTable).not.toContain("useSearchParams");
    expect(superinvestorsTable).not.toContain("useSearchParams");
  });

  test("zero-virtual table isolates the search input and defaults to a 10-row viewport without pagination controls", () => {
    const zeroVirtualTablePath = join(projectRoot, "src/components/ZeroVirtualDataTable.tsx");

    expect(existsSync(zeroVirtualTablePath)).toBe(true);

    if (!existsSync(zeroVirtualTablePath)) {
      return;
    }

    const zeroVirtualTable = readProjectFile("src/components/ZeroVirtualDataTable.tsx");

    expect(zeroVirtualTable).toContain("useZeroVirtualizer");
    expect(zeroVirtualTable).toContain("useHistoryScrollState");
    expect(zeroVirtualTable).toContain("memo(function ZeroVirtualTableSearchInput");
    expect(zeroVirtualTable).toContain("const DEFAULT_VISIBLE_ROW_COUNT = 10");
    expect(zeroVirtualTable).not.toContain("ChevronsLeft");
    expect(zeroVirtualTable).not.toContain("Rows per page");
    expect(zeroVirtualTable).not.toContain("Page ");
  });

  test("zero-virtual table keeps scroll-driven virtualizer state inside a dedicated viewport so the toolbar and sort chrome stay isolated", () => {
    const zeroVirtualTable = readProjectFile("src/components/ZeroVirtualDataTable.tsx");
    const outerComponent = zeroVirtualTable.split("function ZeroVirtualDataTableInner")[1] ?? "";

    expect(zeroVirtualTable).toContain("memo(function ZeroVirtualTableToolbar");
    expect(zeroVirtualTable).toContain("memo(function ZeroVirtualTableHeader");
    expect(zeroVirtualTable).toContain("memo(function ZeroVirtualTableViewport");
    expect(zeroVirtualTable).toContain("onReadyChange");
    expect(outerComponent).not.toContain("useZeroVirtualizer<");
  });

  test("zero query contracts support zero-virtual start-row pagination for assets and superinvestors", () => {
    const zeroQueries = readProjectFile("src/zero/queries.ts");

    expect(zeroQueries).toContain("assetsVirtualPage");
    expect(zeroQueries).toContain("assetsVirtualRowById");
    expect(zeroQueries).toContain("superinvestorsVirtualPage");
    expect(zeroQueries).toContain("superinvestorsVirtualRowById");
    expect(zeroQueries).toContain(".start(start, { inclusive: false })");
    expect(zeroQueries).toContain("dir === \"forward\"");
  });

  test("assets and superinvestors cards drop the subtitle once the table owns the search UX", () => {
    const assetsTable = readProjectFile("src/pages/AssetsTable.tsx");
    const superinvestorsTable = readProjectFile("src/pages/SuperinvestorsTable.tsx");

    expect(assetsTable).not.toContain("CardDescription");
    expect(superinvestorsTable).not.toContain("CardDescription");
  });

  test("app root does not wrap the router tree in StrictMode while using react-scan for render diagnostics", () => {
    const main = readProjectFile("src/main.tsx");

    expect(main).not.toContain("StrictMode");
  });
});
