import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type CDPSession, type Page } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_ROUTE = "/superinvestors/716851";
const DEFAULT_DELAY_MS = 3_000;
const DEFAULT_OUT_DIR = ".artifacts/memory";

type ChromeProcessType =
  | "browser"
  | "renderer"
  | "GPU"
  | "utility"
  | "network.mojom.NetworkService"
  | "storage.mojom.StorageService"
  | "zygote"
  | "sandbox_helper"
  | "unknown"
  | string;

interface ChromeProcessInfo {
  type: ChromeProcessType;
  id: number;
  cpuTime: number;
}

interface ProcessSnapshot {
  totalRssMb: number;
  byTypeRssMb: Record<string, number>;
  processCount: number;
  rendererCount: number;
}

interface HeapUsage {
  usedSize: number;
  totalSize: number;
  embedderHeapUsedSize?: number;
  backingStorageSize?: number;
}

interface DomCounters {
  documents: number;
  nodes: number;
  jsEventListeners: number;
}

interface UserAgentSpecificMemory {
  bytes: number;
  breakdown?: unknown[];
}

interface MemorySample {
  interactionIndex: number | null;
  label: string;
  timestamp: string;
  elapsedMs: number;
  url: string;
  totalChromiumRssMb: number;
  totalChromiumRssDeltaMb: number;
  previousTotalChromiumRssDeltaMb: number | null;
  previousTotalChromiumRssDeltaPercent: number | null;
  rendererRssMb: number;
  processCount: number;
  rendererCount: number;
  processRssByTypeMb: Record<string, number>;
  jsHeapUsedMb: number;
  jsHeapTotalMb: number;
  embedderHeapUsedMb: number | null;
  backingStorageMb: number | null;
  domDocuments: number;
  domNodes: number;
  jsEventListeners: number;
  userAgentSpecificMemoryMb: number | null;
  notes: string[];
}

interface BenchmarkConfig {
  baseUrl: string;
  route: string;
  delayMs: number;
  outDir: string;
  headed: boolean;
  forceGc: boolean;
}

function readOption(argv: string[], index: number, option: string) {
  const next = argv[index + 1];
  if (!next) {
    throw new Error(`${option} requires a value`);
  }

  return next;
}

function parseArgs(argv: string[]): BenchmarkConfig {
  const config: BenchmarkConfig = {
    baseUrl: process.env.BASE_URL || DEFAULT_BASE_URL,
    route: process.env.ROUTE || DEFAULT_ROUTE,
    delayMs: Number(process.env.MEMORY_BENCHMARK_DELAY_MS || DEFAULT_DELAY_MS),
    outDir: process.env.MEMORY_BENCHMARK_OUT_DIR || DEFAULT_OUT_DIR,
    headed: process.env.HEADED === "1" || process.env.HEADED === "true",
    forceGc: process.env.FORCE_GC === "1" || process.env.FORCE_GC === "true",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--headed") {
      config.headed = true;
      continue;
    }

    if (arg === "--force-gc") {
      config.forceGc = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--base-url") {
      config.baseUrl = readOption(argv, index, arg);
      index += 1;
    } else if (arg === "--route") {
      config.route = readOption(argv, index, arg);
      index += 1;
    } else if (arg === "--delay-ms") {
      config.delayMs = Number(readOption(argv, index, arg));
      index += 1;
    } else if (arg === "--out-dir") {
      config.outDir = readOption(argv, index, arg);
      index += 1;
    }
  }

  if (!Number.isFinite(config.delayMs) || config.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }

  return config;
}

function printHelp() {
  console.log(`Tab memory benchmark

Usage:
  bun scripts/benchmark-tab-memory.ts [options]

Options:
  --base-url <url>  App URL. Default: ${DEFAULT_BASE_URL}
  --route <path>    Route to benchmark. Default: ${DEFAULT_ROUTE}
  --delay-ms <ms>   Stabilization delay before each sample. Default: ${DEFAULT_DELAY_MS}
  --out-dir <path>  Directory for JSON/CSV artifacts. Default: ${DEFAULT_OUT_DIR}
  --headed          Run visible Chromium, closer to manual Chrome checks
  --force-gc        Collect garbage before each sample. Useful for retained-memory checks,
                    but do not use when trying to mirror Chrome tab hover memory.

Environment aliases:
  BASE_URL, ROUTE, HEADED=1, FORCE_GC=1, MEMORY_BENCHMARK_DELAY_MS
`);
}

function toMb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function roundMb(value: number) {
  return Math.round(value * 10) / 10;
}

function csvEscape(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function readRssMb(pid: number) {
  try {
    const output = execFileSync("ps", ["-o", "rss=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const rssKb = Number(output);
    return Number.isFinite(rssKb) ? rssKb / 1024 : 0;
  } catch {
    return 0;
  }
}

async function getProcessSnapshot(browserClient: CDPSession): Promise<ProcessSnapshot> {
  const response = await browserClient.send("SystemInfo.getProcessInfo") as { processInfo: ChromeProcessInfo[] };
  const byTypeRssMb: Record<string, number> = {};
  let totalRssMb = 0;
  let rendererCount = 0;

  for (const processInfo of response.processInfo) {
    const rssMb = readRssMb(processInfo.id);
    totalRssMb += rssMb;
    byTypeRssMb[processInfo.type] = (byTypeRssMb[processInfo.type] || 0) + rssMb;
    if (processInfo.type === "renderer") {
      rendererCount += 1;
    }
  }

  return {
    totalRssMb: roundMb(totalRssMb),
    byTypeRssMb: Object.fromEntries(
      Object.entries(byTypeRssMb)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, rssMb]) => [type, roundMb(rssMb)]),
    ),
    processCount: response.processInfo.length,
    rendererCount,
  };
}

async function getUserAgentSpecificMemory(page: Page): Promise<number | null> {
  return await page.evaluate(async () => {
    const performanceWithMemory = performance as Performance & {
      measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
    };

    if (!performanceWithMemory.measureUserAgentSpecificMemory) {
      return null;
    }

    try {
      const sample = await performanceWithMemory.measureUserAgentSpecificMemory() as UserAgentSpecificMemory;
      return sample.bytes;
    } catch {
      return null;
    }
  });
}

async function collectSample(
  interactionIndex: number | null,
  label: string,
  page: Page,
  pageClient: CDPSession,
  browserClient: CDPSession,
  baseline: ProcessSnapshot,
  startedAt: number,
  config: BenchmarkConfig,
): Promise<MemorySample> {
  await page.waitForTimeout(config.delayMs);

  const notes: string[] = [];
  if (config.forceGc) {
    await pageClient.send("HeapProfiler.enable");
    await pageClient.send("HeapProfiler.collectGarbage");
    notes.push("GC forced before this sample; compare separately from Chrome tab-hover memory.");
  }

  const [processSnapshot, heapUsage, domCounters, userAgentMemoryBytes] = await Promise.all([
    getProcessSnapshot(browserClient),
    pageClient.send("Runtime.getHeapUsage") as Promise<HeapUsage>,
    pageClient.send("Memory.getDOMCounters") as Promise<DomCounters>,
    getUserAgentSpecificMemory(page),
  ]);

  const rendererRssMb = processSnapshot.byTypeRssMb.renderer || 0;

  if (userAgentMemoryBytes === null) {
    notes.push("performance.measureUserAgentSpecificMemory unavailable or blocked; this is expected without cross-origin isolation.");
  }

  return {
    interactionIndex,
    label,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    url: page.url(),
    totalChromiumRssMb: processSnapshot.totalRssMb,
    totalChromiumRssDeltaMb: roundMb(processSnapshot.totalRssMb - baseline.totalRssMb),
    previousTotalChromiumRssDeltaMb: null,
    previousTotalChromiumRssDeltaPercent: null,
    rendererRssMb,
    processCount: processSnapshot.processCount,
    rendererCount: processSnapshot.rendererCount,
    processRssByTypeMb: processSnapshot.byTypeRssMb,
    jsHeapUsedMb: toMb(heapUsage.usedSize),
    jsHeapTotalMb: toMb(heapUsage.totalSize),
    embedderHeapUsedMb: typeof heapUsage.embedderHeapUsedSize === "number" ? toMb(heapUsage.embedderHeapUsedSize) : null,
    backingStorageMb: typeof heapUsage.backingStorageSize === "number" ? toMb(heapUsage.backingStorageSize) : null,
    domDocuments: domCounters.documents,
    domNodes: domCounters.nodes,
    jsEventListeners: domCounters.jsEventListeners,
    userAgentSpecificMemoryMb: userAgentMemoryBytes === null ? null : toMb(userAgentMemoryBytes),
    notes,
  };
}

function printSample(sample: MemorySample) {
  const userAgentMemory = sample.userAgentSpecificMemoryMb === null
    ? "n/a"
    : `${sample.userAgentSpecificMemoryMb.toLocaleString()} MB`;
  const previousDelta = sample.previousTotalChromiumRssDeltaMb === null
    ? "prev=n/a"
    : `prev=${sample.previousTotalChromiumRssDeltaMb >= 0 ? "+" : ""}${sample.previousTotalChromiumRssDeltaMb.toLocaleString()} MB`;
  const previousDeltaPercent = sample.previousTotalChromiumRssDeltaPercent === null
    ? "prev%=n/a"
    : `prev%=${sample.previousTotalChromiumRssDeltaPercent >= 0 ? "+" : ""}${sample.previousTotalChromiumRssDeltaPercent.toLocaleString()}%`;

  console.log(
    [
      sample.label.padEnd(28),
      `total=${sample.totalChromiumRssMb.toLocaleString()} MB`,
      previousDelta,
      previousDeltaPercent,
      `baselineDelta=${sample.totalChromiumRssDeltaMb.toLocaleString()} MB`,
      `renderer=${sample.rendererRssMb.toLocaleString()} MB`,
      `heap=${sample.jsHeapUsedMb.toLocaleString()}/${sample.jsHeapTotalMb.toLocaleString()} MB`,
      `backing=${sample.backingStorageMb?.toLocaleString() ?? "n/a"} MB`,
      `dom=${sample.domNodes.toLocaleString()} nodes`,
      `ua=${userAgentMemory}`,
    ].join(" | "),
  );
}

function toCsv(samples: MemorySample[]) {
  const headers = [
    "interactionIndex",
    "label",
    "timestamp",
    "elapsedMs",
    "url",
    "totalChromiumRssMb",
    "totalChromiumRssDeltaMb",
    "previousTotalChromiumRssDeltaMb",
    "previousTotalChromiumRssDeltaPercent",
    "rendererRssMb",
    "processCount",
    "rendererCount",
    "jsHeapUsedMb",
    "jsHeapTotalMb",
    "embedderHeapUsedMb",
    "backingStorageMb",
    "domDocuments",
    "domNodes",
    "jsEventListeners",
    "userAgentSpecificMemoryMb",
  ];

  const rows = samples.map((sample) => headers.map((header) => {
    const value = sample[header as keyof MemorySample];
    return csvEscape(typeof value === "object" ? JSON.stringify(value) : value as string | number | null);
  }).join(","));

  return [headers.join(","), ...rows].join("\n") + "\n";
}

async function waitForAppSettled(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(750);
}

async function navigateToRoute(page: Page, baseUrl: string, route: string) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
  await waitForAppSettled(page);
}

async function fillGlobalSearch(page: Page, term: string) {
  const input = page.locator('input[name="global-search"]').first();
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(term);
  await page.locator('button[data-index="0"]').first().waitFor({ state: "visible", timeout: 10_000 });
  await waitForAppSettled(page);
}

async function clickFirstGlobalSearchResult(page: Page) {
  await page.locator('button[data-index="0"]').first().click();
  await waitForAppSettled(page);
}

async function expandTableSearch(page: Page) {
  const expandButton = page.getByRole("button", { name: "Expand search" }).first();
  if (await expandButton.count()) {
    await expandButton.click();
  }
}

async function fillTableSearch(page: Page, placeholder: string, term: string) {
  await expandTableSearch(page);
  const input = page.getByPlaceholder(placeholder).first();
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(term);
  await waitForAppSettled(page);
}

function withPreviousDelta(sample: MemorySample, previousSample: MemorySample | null): MemorySample {
  if (!previousSample) {
    return sample;
  }

  const deltaMb = roundMb(sample.totalChromiumRssMb - previousSample.totalChromiumRssMb);
  const deltaPercent = previousSample.totalChromiumRssMb === 0
    ? null
    : roundMb((deltaMb / previousSample.totalChromiumRssMb) * 100);

  return {
    ...sample,
    previousTotalChromiumRssDeltaMb: deltaMb,
    previousTotalChromiumRssDeltaPercent: deltaPercent,
  };
}

async function runScenario(
  page: Page,
  pageClient: CDPSession,
  browserClient: CDPSession,
  baseline: ProcessSnapshot,
  startedAt: number,
  config: BenchmarkConfig,
) {
  const samples: MemorySample[] = [];

  async function sample(interactionIndex: number | null, label: string) {
    const memorySample = await collectSample(interactionIndex, label, page, pageClient, browserClient, baseline, startedAt, config);
    const sampleWithDelta = withPreviousDelta(memorySample, samples.at(-1) ?? null);
    samples.push(sampleWithDelta);
    printSample(sampleWithDelta);
  }

  await navigateToRoute(page, config.baseUrl, config.route);
  await sample(null, "pre-interaction");

  await fillGlobalSearch(page, "berkshire");
  await sample(1, "01 global search berkshire");

  await fillGlobalSearch(page, "apple");
  await sample(2, "02 global search apple");

  await fillGlobalSearch(page, "microsoft");
  await sample(3, "03 global search microsoft");

  await clickFirstGlobalSearchResult(page);
  await sample(4, "04 click first global result");

  await navigateToRoute(page, config.baseUrl, "/assets");
  await sample(5, "05 navigate assets");

  await fillTableSearch(page, "Search assets...", "apple");
  await sample(6, "06 assets search apple");

  await fillTableSearch(page, "Search assets...", "microsoft");
  await sample(7, "07 assets search microsoft");

  await navigateToRoute(page, config.baseUrl, "/superinvestors");
  await sample(8, "08 navigate superinvestors");

  await fillTableSearch(page, "Search superinvestors...", "berkshire");
  await sample(9, "09 superinvestors search berkshire");

  await fillTableSearch(page, "Search superinvestors...", "capital");
  await sample(10, "10 superinvestors search capital");

  return samples;
}

async function assertServerIsRunning(baseUrl: string) {
  try {
    const response = await fetch(baseUrl);
    if (response.ok) return;
  } catch {
    // handled below
  }

  throw new Error(`Server is not reachable at ${baseUrl}. Start it with \`bun run dev\` or pass --base-url.`);
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  await assertServerIsRunning(config.baseUrl);

  console.log("Tab memory benchmark");
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Route: ${config.route}`);
  console.log(`Mode: ${config.headed ? "headed" : "headless"}`);
  console.log(`Force GC: ${config.forceGc ? "yes" : "no"}`);
  console.log("Metric note: totalChromiumRssDeltaMb is the closest automated proxy for Chrome tab-hover memory.");
  console.log("");

  const browser = await chromium.launch({
    headless: !config.headed,
    args: [
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--js-flags=--expose-gc",
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1728, height: 1117 },
    });
    const page = await context.newPage();
    const pageClient = await context.newCDPSession(page);
    const browserClient = await browser.newBrowserCDPSession();
    const startedAt = Date.now();
    const baseline = await getProcessSnapshot(browserClient);
    const samples = await runScenario(page, pageClient, browserClient, baseline, startedAt, config);

    const maxTotal = Math.max(...samples.map((sample) => sample.totalChromiumRssMb));
    const maxDelta = Math.max(...samples.map((sample) => sample.totalChromiumRssDeltaMb));
    const maxRenderer = Math.max(...samples.map((sample) => sample.rendererRssMb));
    const preInteraction = samples[0];
    const postInteraction = samples.at(-1) ?? samples[0];
    const postMinusPreMb = roundMb(postInteraction.totalChromiumRssMb - preInteraction.totalChromiumRssMb);
    const postMinusPrePercent = roundMb((postMinusPreMb / preInteraction.totalChromiumRssMb) * 100);
    const maxSample = samples.reduce((currentMax, sample) => (
      sample.totalChromiumRssMb > currentMax.totalChromiumRssMb ? sample : currentMax
    ), samples[0]);

    mkdirSync(config.outDir, { recursive: true });
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    const jsonPath = join(config.outDir, `tab-memory-${timestamp}.json`);
    const csvPath = join(config.outDir, `tab-memory-${timestamp}.csv`);

    writeFileSync(jsonPath, JSON.stringify({
      config,
      baseline,
      summary: {
        preInteractionTotalMb: preInteraction.totalChromiumRssMb,
        postInteractionTotalMb: postInteraction.totalChromiumRssMb,
        postMinusPreMb,
        postMinusPrePercent,
        maxTotal,
        maxDelta,
        maxRenderer,
        maxLabel: maxSample.label,
      },
      samples,
    }, null, 2));
    writeFileSync(csvPath, toCsv(samples));

    console.log("");
    console.log("Summary");
    console.log(`Pre-interaction total Chromium RSS: ${preInteraction.totalChromiumRssMb.toLocaleString()} MB (${(preInteraction.totalChromiumRssMb / 1024).toFixed(2)} GB)`);
    console.log(`Post-interaction total Chromium RSS: ${postInteraction.totalChromiumRssMb.toLocaleString()} MB (${(postInteraction.totalChromiumRssMb / 1024).toFixed(2)} GB)`);
    console.log(`Post minus pre: ${postMinusPreMb >= 0 ? "+" : ""}${postMinusPreMb.toLocaleString()} MB (${postMinusPrePercent >= 0 ? "+" : ""}${postMinusPrePercent.toLocaleString()}%)`);
    console.log(`Max total Chromium RSS: ${maxTotal.toLocaleString()} MB (${(maxTotal / 1024).toFixed(2)} GB) at ${maxSample.label}`);
    console.log(`Max total Chromium RSS delta: ${maxDelta.toLocaleString()} MB (${(maxDelta / 1024).toFixed(2)} GB)`);
    console.log(`Max renderer RSS: ${maxRenderer.toLocaleString()} MB (${(maxRenderer / 1024).toFixed(2)} GB)`);
    console.log(`Artifacts: ${jsonPath}, ${csvPath}`);
  } finally {
    await browser.close();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFilePath) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
