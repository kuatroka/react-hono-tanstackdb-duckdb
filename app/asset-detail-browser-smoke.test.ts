import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { chromium, type Browser, type Page } from "playwright";

let serverProcess: Bun.Subprocess;
let browser: Browser;
let port = 4120;
let baseUrl = `http://127.0.0.1:${port}`;

interface AssetSearchRow {
  asset?: string | null;
  cusip?: string | null;
}

async function getAvailablePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine available port"));
        return;
      }

      const resolvedPort = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(resolvedPort);
      });
    });
  });
}

function startServer() {
  return Bun.spawn(["bun", "api/server.ts"], {
    cwd: import.meta.dir + "/..",
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
}

function trackPageIssues(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleMessages: string[] = [];
  const requests: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    consoleMessages.push(`[${message.type()}] ${message.text()}`);
    if (message.type() === "error" || message.type() === "warning") {
      consoleErrors.push(`[${message.type()}] ${message.text()}`);
    }
  });

  page.on("request", (request) => {
    requests.push(request.url());
  });

  return { pageErrors, consoleErrors, consoleMessages, requests };
}

async function waitForServer(url: string, timeoutMs = 15_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      continue;
    }

    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function resolveAssetDetailPath(search: string) {
  const response = await fetch(`${baseUrl}/api/assets?limit=20&offset=0&search=${encodeURIComponent(search)}`);
  if (!response.ok) {
    throw new Error(`Failed to search assets for ${search}`);
  }

  const payload = await response.json() as { rows?: AssetSearchRow[] };
  const match = payload.rows?.find((row) => row.asset?.toUpperCase() === search.toUpperCase());
  if (!match?.asset) {
    throw new Error(`Asset ${search} not found in API search results`);
  }

  const encodedTicker = encodeURIComponent(match.asset);
  const encodedCusip = encodeURIComponent(match.cusip || "_");
  return `/assets/${encodedTicker}/${encodedCusip}`;
}

describe("asset detail browser smoke test", () => {
  beforeAll(async () => {
    port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = startServer();

    await waitForServer(baseUrl);
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    serverProcess?.kill();
    await serverProcess?.exited;
  });

  test("renders the asset detail page without crashing", async () => {
    const page = await browser.newPage();
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });

    expect(await page.getByText("Something went wrong!").count()).toBe(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });

  test("does not eagerly load heavy global data on the home route", async () => {
    const page = await browser.newPage();
    const { requests, consoleMessages } = trackPageIssues(page);

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    expect(requests.some((url) => url.includes("/api/assets"))).toBe(false);
    expect(requests.some((url) => url.includes("/api/superinvestors"))).toBe(false);
    expect(consoleMessages.some((entry) => entry.includes("[Search] Loading search index..."))).toBe(false);

    await page.close();
  });

  test("does not fetch the full assets collection on asset detail", async () => {
    const page = await browser.newPage();
    const { requests } = trackPageIssues(page);

    await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    expect(requests.some((url) => url.endsWith("/api/assets"))).toBe(false);

    await page.close();
  });

  test("does not fetch the full superinvestors collection on superinvestor detail", async () => {
    const page = await browser.newPage();
    const { requests } = trackPageIssues(page);

    await page.goto(`${baseUrl}/superinvestors/1603466`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    expect(requests.some((url) => url.endsWith("/api/superinvestors"))).toBe(false);

    await page.close();
  });

  test("uses TanStack DB badges on asset detail charts instead of React Query badges", async () => {
    const page = await browser.newPage();

    await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });

    expect(await page.getByText("Investor Activity for BGRN (ECharts)").count()).toBeGreaterThan(0);
    expect(await page.getByText("Net Investor Flow BGRN").count()).toBeGreaterThan(0);

    const pageText = await page.locator("body").textContent();

    expect(pageText).toContain("Tanstack DB");
    expect(pageText).not.toContain("React Query");

    await page.close();
  });

  test("shows render latency and the ECharts-only asset detail layout", async () => {
    const page = await browser.newPage();
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Investor Activity for BGRN (ECharts)");
    await page.waitForSelector("text=Net Investor Flow BGRN");
    await page.waitForSelector("text=Superinvestors who");
    await page.locator('[data-latency-part="render"]').first().waitFor();

    const pageText = await page.locator("body").textContent();

    expect(pageText).toContain("Investor Activity for BGRN (ECharts)");
    expect(pageText).toContain("Net Investor Flow BGRN");
    expect(pageText).toContain("Superinvestors who");
    expect(pageText).not.toContain("(uPlot)");
    expect(pageText).not.toContain("Hover over a bar");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });

  test("renders the investor activity chart on a mobile-sized TSLA asset detail page", async () => {
    const detailPath = await resolveAssetDetailPath("TSLA");
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}${detailPath}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Investor Activity for TSLA (ECharts)");
    await page.locator("canvas").first().waitFor({ state: "visible" });

    const chartBox = await page.locator("canvas").first().boundingBox();
    expect(chartBox).not.toBeNull();
    expect(chartBox && chartBox.width > 0).toBe(true);
    expect(chartBox && chartBox.height > 0).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });

  test("shows compact virtual-table telemetry on the assets route and does not render the removed all-assets chart", async () => {
    const page = await browser.newPage();
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}/assets`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Assets");

    const pageText = await page.locator("body").textContent();

    expect(pageText).not.toContain("All Assets Activity (ECharts)");
    expect(pageText).toContain("virtual table:");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });

  test("shows render latency on the superinvestor chart route", async () => {
    const page = await browser.newPage();
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}/superinvestors/898371`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Portfolio Value Over Time");
    await page.locator('[data-latency-part="render"]').first().waitFor();

    const pageText = await page.locator("body").textContent();

    expect(pageText).toContain("render:");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });
});
