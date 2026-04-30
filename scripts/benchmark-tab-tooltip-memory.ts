import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type CDPSession, type Page } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_ROUTE = "/superinvestors/716851";
const DEFAULT_DELAY_MS = 2_000;
const DEFAULT_TOOLTIP_DELAY_MS = 1_200;
const DEFAULT_OUT_DIR = ".artifacts/memory";
const DEFAULT_CAPTURE_RECT = "0,0,980,320";
const DEFAULT_HOVER_X = 220;
const DEFAULT_HOVER_Y = 56;

interface ChromeProcessInfo {
  type: string;
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

interface TooltipCapture {
  ok: boolean;
  text: string;
  screenshotPath: string;
  memoryMb: number | null;
  memoryRaw: string | null;
  error?: string;
}

interface TooltipMemorySample {
  interactionIndex: number | null;
  label: string;
  timestamp: string;
  elapsedMs: number;
  url: string;
  tooltipMemoryMb: number | null;
  tooltipMemoryRaw: string | null;
  previousTooltipMemoryDeltaMb: number | null;
  previousTooltipMemoryDeltaPercent: number | null;
  tooltipText: string;
  tooltipScreenshotPath: string;
  tooltipError: string | null;
  totalChromiumRssMb: number;
  previousTotalChromiumRssDeltaMb: number | null;
  previousTotalChromiumRssDeltaPercent: number | null;
  rendererRssMb: number;
  processCount: number;
  rendererCount: number;
  processRssByTypeMb: Record<string, number>;
  jsHeapUsedMb: number;
  jsHeapTotalMb: number;
  backingStorageMb: number | null;
  domNodes: number;
  jsEventListeners: number;
}

interface BenchmarkConfig {
  baseUrl: string;
  route: string;
  delayMs: number;
  tooltipDelayMs: number;
  outDir: string;
  hoverX: number;
  hoverY: number;
  captureRect: string;
  browserChannel: string;
  browserAppName: string;
  executablePath: string | null;
}

interface RunPaths {
  runDir: string;
  screenshotsDir: string;
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
    tooltipDelayMs: Number(process.env.TOOLTIP_DELAY_MS || DEFAULT_TOOLTIP_DELAY_MS),
    outDir: process.env.MEMORY_BENCHMARK_OUT_DIR || DEFAULT_OUT_DIR,
    hoverX: Number(process.env.TAB_TOOLTIP_HOVER_X || DEFAULT_HOVER_X),
    hoverY: Number(process.env.TAB_TOOLTIP_HOVER_Y || DEFAULT_HOVER_Y),
    captureRect: process.env.TAB_TOOLTIP_CAPTURE_RECT || DEFAULT_CAPTURE_RECT,
    browserChannel: process.env.BROWSER_CHANNEL || "chrome",
    browserAppName: process.env.BROWSER_APP_NAME || "Google Chrome",
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || null,
  };
  const optionHandlers: Record<string, (value: string) => void> = {
    "--base-url": (value) => { config.baseUrl = value; },
    "--route": (value) => { config.route = value; },
    "--delay-ms": (value) => { config.delayMs = Number(value); },
    "--tooltip-delay-ms": (value) => { config.tooltipDelayMs = Number(value); },
    "--out-dir": (value) => { config.outDir = value; },
    "--hover-x": (value) => { config.hoverX = Number(value); },
    "--hover-y": (value) => { config.hoverY = Number(value); },
    "--capture-rect": (value) => { config.captureRect = value; },
    "--browser-channel": (value) => { config.browserChannel = value; },
    "--browser-app-name": (value) => { config.browserAppName = value; },
    "--executable-path": (value) => { config.executablePath = value; },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    const handleOption = optionHandlers[arg];
    if (handleOption) {
      handleOption(readOption(argv, index, arg));
      index += 1;
    }
  }

  for (const [label, value] of [
    ["--delay-ms", config.delayMs],
    ["--tooltip-delay-ms", config.tooltipDelayMs],
    ["--hover-x", config.hoverX],
    ["--hover-y", config.hoverY],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a number`);
    }
  }

  return config;
}

function printHelp() {
  console.log(`Chrome tab-tooltip memory benchmark

Usage:
  bun scripts/benchmark-tab-tooltip-memory.ts [options]

This macOS-only benchmark runs the same 10 app interactions as benchmark:memory,
but after each interaction it moves the OS cursor over the browser tab, screenshots
the tab tooltip area, OCRs the screenshot with Apple Vision, and records the
tooltip memory value plus CDP/RSS correlation metrics.

Options:
  --base-url <url>          App URL. Default: ${DEFAULT_BASE_URL}
  --route <path>            Initial route. Default: ${DEFAULT_ROUTE}
  --delay-ms <ms>           Stabilization delay before sampling. Default: ${DEFAULT_DELAY_MS}
  --tooltip-delay-ms <ms>   Delay after tab hover before screenshot. Default: ${DEFAULT_TOOLTIP_DELAY_MS}
  --hover-x <px>            Screen x coordinate for the tab hover. Default: ${DEFAULT_HOVER_X}
  --hover-y <px>            Screen y coordinate for the tab hover. Default: ${DEFAULT_HOVER_Y}
  --capture-rect <rect>     Screenshot rect x,y,width,height. Default: ${DEFAULT_CAPTURE_RECT}
  --browser-channel <name>  Playwright browser channel. Default: chrome
  --browser-app-name <name> macOS app name to activate before OCR. Default: Google Chrome
  --executable-path <path>  Chromium-family browser executable, e.g. Brave Browser
  --out-dir <path>          Artifact directory. Default: ${DEFAULT_OUT_DIR}

Requirements:
  macOS, Swift, Google Chrome, Screen Recording permission, and Accessibility
  permission for the terminal if mouse movement is blocked.
`);
}

function toMb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function csvEscape(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function sanitizeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
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

function activateBrowser(appName: string) {
  try {
    execFileSync("osascript", ["-e", `tell application ${JSON.stringify(appName)} to activate`], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    // The OCR helper still attempts the screenshot; this only improves focus reliability.
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
    totalRssMb: roundOne(totalRssMb),
    byTypeRssMb: Object.fromEntries(
      Object.entries(byTypeRssMb)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, rssMb]) => [type, roundOne(rssMb)]),
    ),
    processCount: response.processInfo.length,
    rendererCount,
  };
}

function parseTooltipMemory(text: string): { memoryMb: number | null; memoryRaw: string | null } {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const labeledMatch = normalizedText.match(/(?:high\s+memory\s+usage|memory\s+usage)\D{0,40}(\d+(?:\.\d+)?)\s*([GM]B)/i);
  const fallbackMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*([GM]B)/i);
  const match = labeledMatch || fallbackMatch;

  if (!match) {
    return { memoryMb: null, memoryRaw: null };
  }

  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (!Number.isFinite(value)) {
    return { memoryMb: null, memoryRaw: null };
  }

  return {
    memoryMb: unit === "GB" ? roundOne(value * 1024) : roundOne(value),
    memoryRaw: `${value} ${unit}`,
  };
}

function captureTooltipMemory(config: BenchmarkConfig, paths: RunPaths, label: string): TooltipCapture {
  const screenshotPath = join(paths.screenshotsDir, `${sanitizeFilePart(label)}.png`);

  try {
    activateBrowser(config.browserAppName);
    const output = execFileSync("swift", [
      "scripts/macos-tab-tooltip-ocr.swift",
      "--hover-x",
      String(config.hoverX),
      "--hover-y",
      String(config.hoverY),
      "--rect",
      config.captureRect,
      "--delay-ms",
      String(config.tooltipDelayMs),
      "--out",
      screenshotPath,
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const payload = JSON.parse(output) as { ok: boolean; text?: string; screenshotPath?: string; error?: string };
    const text = payload.text || "";
    const parsedMemory = parseTooltipMemory(text);

    return {
      ok: payload.ok,
      text,
      screenshotPath: payload.screenshotPath || screenshotPath,
      memoryMb: parsedMemory.memoryMb,
      memoryRaw: parsedMemory.memoryRaw,
      error: payload.error,
    };
  } catch (error) {
    return {
      ok: false,
      text: "",
      screenshotPath,
      memoryMb: null,
      memoryRaw: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

async function collectSample(
  interactionIndex: number | null,
  label: string,
  page: Page,
  pageClient: CDPSession,
  browserClient: CDPSession,
  config: BenchmarkConfig,
  paths: RunPaths,
  startedAt: number,
): Promise<TooltipMemorySample> {
  await page.waitForTimeout(config.delayMs);

  const [processSnapshot, heapUsage, domCounters] = await Promise.all([
    getProcessSnapshot(browserClient),
    pageClient.send("Runtime.getHeapUsage") as Promise<HeapUsage>,
    pageClient.send("Memory.getDOMCounters") as Promise<DomCounters>,
  ]);
  const tooltip = captureTooltipMemory(config, paths, label);

  return {
    interactionIndex,
    label,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    url: page.url(),
    tooltipMemoryMb: tooltip.memoryMb,
    tooltipMemoryRaw: tooltip.memoryRaw,
    previousTooltipMemoryDeltaMb: null,
    previousTooltipMemoryDeltaPercent: null,
    tooltipText: tooltip.text,
    tooltipScreenshotPath: tooltip.screenshotPath,
    tooltipError: tooltip.ok ? null : tooltip.error || "Tooltip OCR failed",
    totalChromiumRssMb: processSnapshot.totalRssMb,
    previousTotalChromiumRssDeltaMb: null,
    previousTotalChromiumRssDeltaPercent: null,
    rendererRssMb: processSnapshot.byTypeRssMb.renderer || 0,
    processCount: processSnapshot.processCount,
    rendererCount: processSnapshot.rendererCount,
    processRssByTypeMb: processSnapshot.byTypeRssMb,
    jsHeapUsedMb: toMb(heapUsage.usedSize),
    jsHeapTotalMb: toMb(heapUsage.totalSize),
    backingStorageMb: typeof heapUsage.backingStorageSize === "number" ? toMb(heapUsage.backingStorageSize) : null,
    domNodes: domCounters.nodes,
    jsEventListeners: domCounters.jsEventListeners,
  };
}

function withPreviousDelta(
  sample: TooltipMemorySample,
  previousSample: TooltipMemorySample | null,
): TooltipMemorySample {
  if (!previousSample) {
    return sample;
  }

  const rssDeltaMb = roundOne(sample.totalChromiumRssMb - previousSample.totalChromiumRssMb);
  const rssDeltaPercent = previousSample.totalChromiumRssMb === 0
    ? null
    : roundOne((rssDeltaMb / previousSample.totalChromiumRssMb) * 100);
  const tooltipDeltaMb = sample.tooltipMemoryMb === null || previousSample.tooltipMemoryMb === null
    ? null
    : roundOne(sample.tooltipMemoryMb - previousSample.tooltipMemoryMb);
  const tooltipDeltaPercent = tooltipDeltaMb === null || previousSample.tooltipMemoryMb === null || previousSample.tooltipMemoryMb === 0
    ? null
    : roundOne((tooltipDeltaMb / previousSample.tooltipMemoryMb) * 100);

  return {
    ...sample,
    previousTooltipMemoryDeltaMb: tooltipDeltaMb,
    previousTooltipMemoryDeltaPercent: tooltipDeltaPercent,
    previousTotalChromiumRssDeltaMb: rssDeltaMb,
    previousTotalChromiumRssDeltaPercent: rssDeltaPercent,
  };
}

function printSample(sample: TooltipMemorySample) {
  const tooltipMemory = sample.tooltipMemoryRaw || "n/a";
  const tooltipDelta = sample.previousTooltipMemoryDeltaMb === null
    ? "tooltipPrev=n/a"
    : `tooltipPrev=${sample.previousTooltipMemoryDeltaMb >= 0 ? "+" : ""}${sample.previousTooltipMemoryDeltaMb.toLocaleString()} MB`;
  const tooltipDeltaPercent = sample.previousTooltipMemoryDeltaPercent === null
    ? "tooltipPrev%=n/a"
    : `tooltipPrev%=${sample.previousTooltipMemoryDeltaPercent >= 0 ? "+" : ""}${sample.previousTooltipMemoryDeltaPercent.toLocaleString()}%`;
  const rssDelta = sample.previousTotalChromiumRssDeltaMb === null
    ? "rssPrev=n/a"
    : `rssPrev=${sample.previousTotalChromiumRssDeltaMb >= 0 ? "+" : ""}${sample.previousTotalChromiumRssDeltaMb.toLocaleString()} MB`;

  console.log(
    [
      sample.label.padEnd(34),
      `tooltip=${tooltipMemory}`,
      tooltipDelta,
      tooltipDeltaPercent,
      `rss=${sample.totalChromiumRssMb.toLocaleString()} MB`,
      rssDelta,
      `heap=${sample.jsHeapUsedMb.toLocaleString()}/${sample.jsHeapTotalMb.toLocaleString()} MB`,
      sample.tooltipError ? `ocrError=${sample.tooltipError}` : null,
    ].filter(Boolean).join(" | "),
  );
}

function toCsv(samples: TooltipMemorySample[]) {
  const headers = [
    "interactionIndex",
    "label",
    "timestamp",
    "elapsedMs",
    "url",
    "tooltipMemoryMb",
    "tooltipMemoryRaw",
    "previousTooltipMemoryDeltaMb",
    "previousTooltipMemoryDeltaPercent",
    "tooltipText",
    "tooltipScreenshotPath",
    "tooltipError",
    "totalChromiumRssMb",
    "previousTotalChromiumRssDeltaMb",
    "previousTotalChromiumRssDeltaPercent",
    "rendererRssMb",
    "processCount",
    "rendererCount",
    "jsHeapUsedMb",
    "jsHeapTotalMb",
    "backingStorageMb",
    "domNodes",
    "jsEventListeners",
  ];

  const rows = samples.map((sample) => headers.map((header) => {
    const value = sample[header as keyof TooltipMemorySample];
    return csvEscape(typeof value === "object" ? JSON.stringify(value) : value as string | number | null);
  }).join(","));

  return [headers.join(","), ...rows].join("\n") + "\n";
}

async function runScenario(
  page: Page,
  pageClient: CDPSession,
  browserClient: CDPSession,
  config: BenchmarkConfig,
  paths: RunPaths,
  startedAt: number,
) {
  const samples: TooltipMemorySample[] = [];

  async function sample(interactionIndex: number | null, label: string) {
    const memorySample = await collectSample(interactionIndex, label, page, pageClient, browserClient, config, paths, startedAt);
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

function summarizeTooltip(samples: TooltipMemorySample[]) {
  const validTooltipSamples = samples.filter((sample) => sample.tooltipMemoryMb !== null);
  const preInteraction = samples[0];
  const postInteraction = samples.at(-1) ?? samples[0];
  const firstTooltip = validTooltipSamples[0]?.tooltipMemoryMb ?? null;
  const lastTooltip = [...validTooltipSamples].at(-1)?.tooltipMemoryMb ?? null;
  const postMinusPreTooltipMb = firstTooltip === null || lastTooltip === null
    ? null
    : roundOne(lastTooltip - firstTooltip);
  const postMinusPreTooltipPercent = postMinusPreTooltipMb === null || firstTooltip === null || firstTooltip === 0
    ? null
    : roundOne((postMinusPreTooltipMb / firstTooltip) * 100);
  const maxTooltipSample = validTooltipSamples.reduce<TooltipMemorySample | null>((currentMax, sample) => {
    if (!currentMax) return sample;
    return (sample.tooltipMemoryMb ?? 0) > (currentMax.tooltipMemoryMb ?? 0) ? sample : currentMax;
  }, null);
  const postMinusPreRssMb = roundOne(postInteraction.totalChromiumRssMb - preInteraction.totalChromiumRssMb);
  const postMinusPreRssPercent = roundOne((postMinusPreRssMb / preInteraction.totalChromiumRssMb) * 100);

  return {
    firstTooltipMemoryMb: firstTooltip,
    lastTooltipMemoryMb: lastTooltip,
    postMinusPreTooltipMb,
    postMinusPreTooltipPercent,
    maxTooltipMemoryMb: maxTooltipSample?.tooltipMemoryMb ?? null,
    maxTooltipLabel: maxTooltipSample?.label ?? null,
    preInteractionRssMb: preInteraction.totalChromiumRssMb,
    postInteractionRssMb: postInteraction.totalChromiumRssMb,
    postMinusPreRssMb,
    postMinusPreRssPercent,
    ocrFailures: samples.filter((sample) => sample.tooltipMemoryMb === null).length,
  };
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("benchmark-tab-tooltip-memory.ts is macOS-only because it uses screencapture and Apple Vision OCR.");
  }

  const config = parseArgs(process.argv.slice(2));
  await assertServerIsRunning(config.baseUrl);

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const runDir = join(config.outDir, `tab-tooltip-memory-${timestamp}`);
  const screenshotsDir = join(runDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });
  const paths: RunPaths = { runDir, screenshotsDir };

  console.log("Chrome tab-tooltip memory benchmark");
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Route: ${config.route}`);
  console.log(`Browser channel: ${config.browserChannel}`);
  if (config.executablePath) {
    console.log(`Executable path: ${config.executablePath}`);
  }
  console.log(`Browser app name: ${config.browserAppName}`);
  console.log(`Tab hover: (${config.hoverX}, ${config.hoverY})`);
  console.log(`Capture rect: ${config.captureRect}`);
  console.log("Metric note: tooltipMemoryMb is OCR-extracted from the browser tab-hover tooltip.");
  console.log("");

  const browser = await chromium.launch({
    ...(config.executablePath ? { executablePath: config.executablePath } : { channel: config.browserChannel }),
    headless: false,
    args: [
      "--window-position=0,0",
      "--window-size=1728,1117",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1728, height: 980 },
    });
    const page = await context.newPage();
    const pageClient = await context.newCDPSession(page);
    const browserClient = await browser.newBrowserCDPSession();
    const startedAt = Date.now();
    const samples = await runScenario(page, pageClient, browserClient, config, paths, startedAt);
    const summary = summarizeTooltip(samples);
    const jsonPath = join(runDir, "tab-tooltip-memory.json");
    const csvPath = join(runDir, "tab-tooltip-memory.csv");

    writeFileSync(jsonPath, JSON.stringify({ config, summary, samples }, null, 2));
    writeFileSync(csvPath, toCsv(samples));

    console.log("");
    console.log("Summary");
    console.log(`First tooltip memory: ${summary.firstTooltipMemoryMb === null ? "n/a" : `${summary.firstTooltipMemoryMb.toLocaleString()} MB`}`);
    console.log(`Last tooltip memory: ${summary.lastTooltipMemoryMb === null ? "n/a" : `${summary.lastTooltipMemoryMb.toLocaleString()} MB`}`);
    console.log(`Tooltip post minus pre: ${summary.postMinusPreTooltipMb === null ? "n/a" : `${summary.postMinusPreTooltipMb >= 0 ? "+" : ""}${summary.postMinusPreTooltipMb.toLocaleString()} MB (${summary.postMinusPreTooltipPercent! >= 0 ? "+" : ""}${summary.postMinusPreTooltipPercent!.toLocaleString()}%)`}`);
    console.log(`Max tooltip memory: ${summary.maxTooltipMemoryMb === null ? "n/a" : `${summary.maxTooltipMemoryMb.toLocaleString()} MB at ${summary.maxTooltipLabel}`}`);
    console.log(`RSS post minus pre: ${summary.postMinusPreRssMb >= 0 ? "+" : ""}${summary.postMinusPreRssMb.toLocaleString()} MB (${summary.postMinusPreRssPercent >= 0 ? "+" : ""}${summary.postMinusPreRssPercent.toLocaleString()}%)`);
    console.log(`OCR failures: ${summary.ocrFailures}`);
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
