import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type ConsoleMessage,
  type Page,
} from "playwright";

const ARCHITECTURES = ["baseline", "sqlite-idb", "sqlite-opfs"] as const;
type ArchitectureId = (typeof ARCHITECTURES)[number];
type ScenarioMode = "cold" | "warm";

type MemorySnapshot = {
  jsHeapUsedSize?: number;
  jsHeapTotalSize?: number;
  uaBytes?: number;
};

type RouteMetrics = {
  routeReadyMs: number | null;
  visualReadyMs: number | null;
  totalNavigationMs: number;
  latencyBadgeText: string[];
  componentTelemetry: ComponentTelemetry[];
};

type ComponentTelemetry = {
  text: string;
  mode: string | null;
  source: string | null;
  dataLoadMs: number | null;
  renderMs: number | null;
};

type BenchmarkRunResult = {
  architecture: ArchitectureId;
  architectureLabel: string;
  scenarioId: string;
  scenarioLabel: string;
  mode: ScenarioMode;
  iteration: number;
  url: string;
  startedAt: string;
  metrics: RouteMetrics;
  memory: {
    before: MemorySnapshot;
    after: MemorySnapshot;
    delta: MemorySnapshot;
  };
  signals: {
    contentReadyState: unknown;
    requestedPersistenceArchitecture: string | null;
    persistenceArchitecture: string | null;
  };
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: Array<{ url: string; status: number | null }>;
};

type NumericMetricKey =
  | "routeReadyMs"
  | "visualReadyMs"
  | "totalNavigationMs"
  | "jsHeapUsedSizeDelta"
  | "jsHeapTotalSizeDelta"
  | "uaBytesDelta";

type AggregateMetric = {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
};

type AggregateSummary = {
  architecture: ArchitectureId;
  scenarioId: string;
  mode: ScenarioMode;
  iterations: number;
  metrics: Partial<Record<NumericMetricKey, AggregateMetric>>;
  consoleErrorCount: number;
  pageErrorCount: number;
  failedRequestCount: number;
};

type Scenario = {
  id: string;
  label: string;
  path: string;
  routeReadyTimeoutMs?: number;
  renderSelector?: string;
  renderTimeoutMs?: number;
};

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:4000";
const ITERATIONS = clampPositiveInt(process.env.BENCHMARK_ITERATIONS, 5);
const HEADLESS = parseBooleanEnv(process.env.BENCHMARK_HEADLESS, true);
const RESULTS_DIR = process.env.BENCHMARK_RESULTS_DIR
  ? join(process.cwd(), process.env.BENCHMARK_RESULTS_DIR)
  : join(process.cwd(), "benchmark-results", "browser-persistence");
const ARCH_FILTER = parseArchitectureFilter(process.env.BENCHMARK_ARCHITECTURES);
const SCENARIO_FILTER = parseCsv(process.env.BENCHMARK_SCENARIOS);

const SCENARIOS: Scenario[] = [
  {
    id: "assets-table",
    label: "Assets virtual table",
    path: "/assets",
    renderSelector: "text=Assets",
  },
  {
    id: "superinvestors-table",
    label: "Superinvestors virtual table",
    path: "/superinvestors",
    renderSelector: "text=Superinvestors",
  },
  {
    id: "asset-detail",
    label: "Asset detail charts",
    path: "/assets/BGRN/46435U440",
    renderSelector: "text=Investor Activity for BGRN (uPlot)",
    renderTimeoutMs: 20000,
  },
  {
    id: "superinvestor-detail",
    label: "Superinvestor detail chart",
    path: "/superinvestors/898371",
    renderSelector: "text=Portfolio Value Over Time",
    renderTimeoutMs: 20000,
  },
  {
    id: "investor-drilldown",
    label: "Investor drilldown",
    path: "/assets/BGRN/46435U440",
    renderSelector: "text=Superinvestors who",
    renderTimeoutMs: 25000,
  },
];

function clampPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

function parseCsv(value: string | undefined): Set<string> | null {
  if (!value) return null;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? new Set(items) : null;
}

function parseArchitectureFilter(value: string | undefined): ArchitectureId[] {
  const filter = parseCsv(value);
  if (!filter) return [...ARCHITECTURES];
  return ARCHITECTURES.filter((architecture) => filter.has(architecture));
}

function architectureLabel(architecture: ArchitectureId): string {
  switch (architecture) {
    case "baseline":
      return "TanStack DB + Dexie/IndexedDB";
    case "sqlite-idb":
      return "TanStack DB + SQLite WASM (IndexedDB VFS)";
    case "sqlite-opfs":
      return "SQLite WASM + OPFS worker";
  }
}

function withArchitecture(path: string, architecture: ArchitectureId): string {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("persistence", architecture);
  return url.toString();
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${ms.toFixed(2)}ms`;
}

function parseMaybeNumber(value: string | null | undefined): number | null {
  if (value == null || value.length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function memoryDelta(before: MemorySnapshot, after: MemorySnapshot): MemorySnapshot {
  return {
    jsHeapUsedSize: subtractMaybe(after.jsHeapUsedSize, before.jsHeapUsedSize),
    jsHeapTotalSize: subtractMaybe(after.jsHeapTotalSize, before.jsHeapTotalSize),
    uaBytes: subtractMaybe(after.uaBytes, before.uaBytes),
  };
}

function subtractMaybe(after?: number, before?: number): number | undefined {
  if (after == null || before == null) return undefined;
  return after - before;
}

async function captureMemorySnapshot(page: Page, cdp: CDPSession | null): Promise<MemorySnapshot> {
  const snapshot: MemorySnapshot = {};

  if (cdp) {
    try {
      const metrics = await cdp.send("Performance.getMetrics");
      const values = new Map(metrics.metrics.map((metric) => [metric.name, metric.value]));
      const used = values.get("JSHeapUsedSize");
      const total = values.get("JSHeapTotalSize");
      if (typeof used === "number") snapshot.jsHeapUsedSize = used;
      if (typeof total === "number") snapshot.jsHeapTotalSize = total;
    } catch {
      // Best effort only.
    }
  }

  try {
    const uaBytes = await page.evaluate(async () => {
      const perf = performance as Performance & {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
      };
      if (typeof perf.measureUserAgentSpecificMemory !== "function") {
        return null;
      }
      const result = await perf.measureUserAgentSpecificMemory();
      return typeof result?.bytes === "number" ? result.bytes : null;
    });

    if (typeof uaBytes === "number") {
      snapshot.uaBytes = uaBytes;
    }
  } catch {
    // Some environments gate this API behind permissions or flags.
  }

  return snapshot;
}

async function waitForRouteReady(page: Page, timeoutMs: number): Promise<unknown> {
  await page.waitForFunction(
    () => {
      const readyState = (window as Window & {
        __FINTELLECTUS_CONTENT_READY__?: { isReady?: boolean };
      }).__FINTELLECTUS_CONTENT_READY__;
      return readyState?.isReady === true || document.documentElement.dataset.contentReady === "true";
    },
    { timeout: timeoutMs },
  );

  return page.evaluate(() => {
    const windowState = (window as Window & {
      __FINTELLECTUS_CONTENT_READY__?: unknown;
    }).__FINTELLECTUS_CONTENT_READY__;

    return windowState ?? {
      contentReady: document.documentElement.dataset.contentReady ?? null,
      contentReadyCount: document.documentElement.dataset.contentReadyCount ?? null,
      contentReadyPath: document.documentElement.dataset.contentReadyPath ?? null,
    };
  });
}

async function collectComponentTelemetry(page: Page): Promise<ComponentTelemetry[]> {
  const rawTelemetry = await page
    .locator('[data-testid="latency-badge"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const htmlElement = element as HTMLElement;
          const text = htmlElement.textContent?.trim() ?? "";
          if (!text) return null;

          return {
            text,
            mode: htmlElement.dataset.latencyMode ?? null,
            source: htmlElement.dataset.latencySource ?? null,
            dataLoadMs: htmlElement.dataset.latencyDataMs ?? null,
            renderMs: htmlElement.dataset.latencyRenderMs ?? null,
          };
        })
        .filter((entry): entry is {
          text: string;
          mode: string | null;
          source: string | null;
          dataLoadMs: string | null;
          renderMs: string | null;
        } => Boolean(entry)),
    )
    .catch(() => [] as Array<{
      text: string;
      mode: string | null;
      source: string | null;
      dataLoadMs: string | null;
      renderMs: string | null;
    }>);

  return rawTelemetry.map((entry) => ({
    text: entry.text,
    mode: entry.mode,
    source: entry.source,
    dataLoadMs: parseMaybeNumber(entry.dataLoadMs),
    renderMs: parseMaybeNumber(entry.renderMs),
  }));
}

function attachIssueTrackers(page: Page): {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: Array<{ url: string; status: number | null }>;
} {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{ url: string; status: number | null }> = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error: Error) => {
    pageErrors.push(String(error));
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push({ url: response.url(), status: response.status() });
    }
  });

  page.on("requestfailed", (request) => {
    failedRequests.push({ url: request.url(), status: null });
  });

  return { consoleErrors, pageErrors, failedRequests };
}

async function measureScenario(
  context: BrowserContext,
  architecture: ArchitectureId,
  scenario: Scenario,
  mode: ScenarioMode,
  iteration: number,
): Promise<BenchmarkRunResult> {
  const page = await context.newPage();
  const issues = attachIssueTrackers(page);
  const cdp = await context.newCDPSession(page).catch(() => null);

  const url = withArchitecture(scenario.path, architecture);
  const startedAt = new Date().toISOString();
  const beforeMemory = await captureMemorySnapshot(page, cdp);
  const startedAtMs = performance.now();

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const routeReadyState = await waitForRouteReady(page, scenario.routeReadyTimeoutMs ?? 20000);
  const routeReadyMs = performance.now() - startedAtMs;

  let visualReadyMs: number | null = null;
  if (scenario.renderSelector) {
    await page.waitForSelector(scenario.renderSelector, {
      state: "visible",
      timeout: scenario.renderTimeoutMs ?? 15000,
    });
    visualReadyMs = performance.now() - startedAtMs;
  }

  await page
    .waitForFunction(
      () => document.querySelectorAll('[data-testid="latency-badge"]').length > 0,
      { timeout: 10000 },
    )
    .catch(() => null);

  const afterMemory = await captureMemorySnapshot(page, cdp);
  const totalNavigationMs = performance.now() - startedAtMs;
  const componentTelemetry = await collectComponentTelemetry(page);
  const latencyBadgeText = componentTelemetry.map((entry) => entry.text);
  const persistenceArchitecture = await page
    .evaluate(() => {
      const appWindow = window as Window & {
        __APP_PERSISTENCE_ARCHITECTURE__?: string;
        __APP_REQUESTED_PERSISTENCE_ARCHITECTURE__?: string;
      };
      return {
        requested:
          appWindow.__APP_REQUESTED_PERSISTENCE_ARCHITECTURE__
          ?? document.documentElement.dataset.requestedPersistenceArchitecture
          ?? null,
        active:
          appWindow.__APP_PERSISTENCE_ARCHITECTURE__
          ?? document.documentElement.dataset.persistenceArchitecture
          ?? null,
      };
    })
    .catch(() => null);

  await page.close();

  return {
    architecture,
    architectureLabel: architectureLabel(architecture),
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    mode,
    iteration,
    url,
    startedAt,
    metrics: {
      routeReadyMs,
      visualReadyMs,
      totalNavigationMs,
      latencyBadgeText,
      componentTelemetry,
    },
    memory: {
      before: beforeMemory,
      after: afterMemory,
      delta: memoryDelta(beforeMemory, afterMemory),
    },
    signals: {
      contentReadyState: routeReadyState,
      requestedPersistenceArchitecture: persistenceArchitecture?.requested ?? null,
      persistenceArchitecture: persistenceArchitecture?.active ?? null,
    },
    consoleErrors: issues.consoleErrors,
    pageErrors: issues.pageErrors,
    failedRequests: issues.failedRequests,
  };
}

async function runColdScenario(
  browser: Browser,
  architecture: ArchitectureId,
  scenario: Scenario,
  iteration: number,
): Promise<BenchmarkRunResult> {
  const context = await browser.newContext();
  try {
    return await measureScenario(context, architecture, scenario, "cold", iteration);
  } finally {
    await context.close();
  }
}

async function runWarmScenario(
  browser: Browser,
  architecture: ArchitectureId,
  scenario: Scenario,
  iteration: number,
): Promise<BenchmarkRunResult> {
  const context = await browser.newContext();
  try {
    await measureScenario(context, architecture, scenario, "warm", 0);
    return await measureScenario(context, architecture, scenario, "warm", iteration);
  } finally {
    await context.close();
  }
}

function toFiniteArray(value: number | null | undefined): number[] {
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
}

function summarizeMetric(values: number[]): AggregateMetric {
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    avg,
    min: Math.min(...values),
    max: Math.max(...values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function aggregateResults(results: BenchmarkRunResult[]): AggregateSummary[] {
  const groups = new Map<string, BenchmarkRunResult[]>();

  for (const result of results) {
    const key = [result.architecture, result.scenarioId, result.mode].join("::");
    const bucket = groups.get(key) ?? [];
    bucket.push(result);
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([key, bucket]) => {
    const [architecture, scenarioId, mode] = key.split("::") as [ArchitectureId, string, ScenarioMode];
    const numericMetrics: Record<NumericMetricKey, number[]> = {
      routeReadyMs: bucket.flatMap((result) => toFiniteArray(result.metrics.routeReadyMs)),
      visualReadyMs: bucket.flatMap((result) => toFiniteArray(result.metrics.visualReadyMs)),
      totalNavigationMs: bucket.flatMap((result) => toFiniteArray(result.metrics.totalNavigationMs)),
      jsHeapUsedSizeDelta: bucket.flatMap((result) => toFiniteArray(result.memory.delta.jsHeapUsedSize)),
      jsHeapTotalSizeDelta: bucket.flatMap((result) => toFiniteArray(result.memory.delta.jsHeapTotalSize)),
      uaBytesDelta: bucket.flatMap((result) => toFiniteArray(result.memory.delta.uaBytes)),
    };

    const metrics = Object.fromEntries(
      Object.entries(numericMetrics)
        .filter(([, values]) => values.length > 0)
        .map(([metricKey, values]) => [metricKey, summarizeMetric(values)]),
    ) as Partial<Record<NumericMetricKey, AggregateMetric>>;

    return {
      architecture,
      scenarioId,
      mode,
      iterations: bucket.length,
      metrics,
      consoleErrorCount: bucket.reduce((sum, result) => sum + result.consoleErrors.length, 0),
      pageErrorCount: bucket.reduce((sum, result) => sum + result.pageErrors.length, 0),
      failedRequestCount: bucket.reduce((sum, result) => sum + result.failedRequests.length, 0),
    };
  });
}

function selectedScenarios(): Scenario[] {
  if (!SCENARIO_FILTER) {
    return SCENARIOS;
  }

  return SCENARIOS.filter((scenario) => SCENARIO_FILTER.has(scenario.id));
}

async function ensureServer(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    if (!response) {
      throw new Error(`No response when opening ${BASE_URL}`);
    }
  } finally {
    await context.close();
  }
}

function printSummary(summaries: AggregateSummary[]): void {
  console.log("\n📊 Browser persistence benchmark summary\n");

  for (const summary of summaries) {
    const routeReady = summary.metrics.routeReadyMs;
    const visualReady = summary.metrics.visualReadyMs;
    const heapDelta = summary.metrics.jsHeapUsedSizeDelta;
    console.log(
      `- ${summary.architecture} | ${summary.scenarioId} | ${summary.mode}: `
      + `route=${formatMs(routeReady?.avg)} p95=${formatMs(routeReady?.p95)} `
      + `visual=${formatMs(visualReady?.avg)} `
      + `heapΔ=${heapDelta ? `${(heapDelta.avg / (1024 * 1024)).toFixed(2)}MB` : "—"}`,
    );
  }
}

async function main(): Promise<void> {
  const scenarios = selectedScenarios();
  if (scenarios.length === 0) {
    throw new Error("No benchmark scenarios selected.");
  }

  await mkdir(RESULTS_DIR, { recursive: true });

  console.log("🏁 Browser-local persistence benchmark");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Architectures: ${ARCH_FILTER.join(", ")}`);
  console.log(`Scenarios: ${scenarios.map((scenario) => scenario.id).join(", ")}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Headless: ${HEADLESS}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const startedAt = new Date().toISOString();
  const rawResults: BenchmarkRunResult[] = [];

  try {
    await ensureServer(browser);

    for (const architecture of ARCH_FILTER) {
      console.log(`\n════════ ${architectureLabel(architecture)} (${architecture}) ════════`);
      for (const scenario of scenarios) {
        console.log(`\n▶ ${scenario.label}`);
        for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
          console.log(`  cold #${iteration}`);
          rawResults.push(await runColdScenario(browser, architecture, scenario, iteration));
          console.log(`  warm #${iteration}`);
          rawResults.push(await runWarmScenario(browser, architecture, scenario, iteration));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const summary = aggregateResults(rawResults);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = join(RESULTS_DIR, `browser-persistence-${timestamp}.json`);

  const payload = {
    meta: {
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      iterations: ITERATIONS,
      architectures: ARCH_FILTER,
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        path: scenario.path,
      })),
    },
    summary,
    rawResults,
  };

  await writeFile(resultsPath, JSON.stringify(payload, null, 2));
  printSummary(summary);
  console.log(`\n✅ Wrote results to ${resultsPath}`);
}

main().catch((error) => {
  console.error("❌ Browser persistence benchmark failed:", error);
  process.exit(1);
});
