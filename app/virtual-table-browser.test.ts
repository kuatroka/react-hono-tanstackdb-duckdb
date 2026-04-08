import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";

const port = 4121;
const baseUrl = `http://127.0.0.1:${port}`;

let apiProcess: Bun.Subprocess;
let cssProcess: Bun.Subprocess;
let browser: Browser;

function trackRequests(page: Page) {
  const requests: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (request) => {
    requests.push(request.url());
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return { requests, pageErrors, consoleErrors };
}

async function waitForServer(url: string, timeoutMs = 15_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }

    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function getMountedVirtualRows(page: Page) {
  return await page.locator("[data-row-index]").count();
}

describe("virtual table browser behavior", () => {
  beforeAll(async () => {
    cssProcess = Bun.spawn(["bun", "run", "dev:css"], {
      cwd: import.meta.dir + "/..",
      env: {
        ...process.env,
      },
      stdout: "inherit",
      stderr: "inherit",
    });

    apiProcess = Bun.spawn(["bun", "run", "dev:api"], {
      cwd: import.meta.dir + "/..",
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdout: "inherit",
      stderr: "inherit",
    });

    await waitForServer(baseUrl);
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    cssProcess?.kill();
    apiProcess?.kill();
    await Promise.allSettled([cssProcess?.exited, apiProcess?.exited]);
  });

  test("assets route uses bounded virtual fetches and keeps only a small mounted window while scrolling", async () => {
    const page = await browser.newPage();
    const { requests, pageErrors, consoleErrors } = trackRequests(page);

    await page.goto(`${baseUrl}/assets`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="zero-virtual-scroll-container"]');

    const initialRows = await getMountedVirtualRows(page);
    const firstVisibleAsset = await page.locator('[data-row-index="0"] a').first().textContent();

    await page.locator('[data-testid="zero-virtual-scroll-container"]').evaluate((element) => {
      element.scrollTop = 5000;
    });
    await page.waitForTimeout(500);

    const rowsAfterScroll = await getMountedVirtualRows(page);
    const firstVisibleAfterScroll = await page.locator("[data-row-index] a").first().textContent();

    expect(initialRows).toBeLessThan(30);
    expect(rowsAfterScroll).toBeLessThan(30);
    expect(firstVisibleAfterScroll).not.toBe(firstVisibleAsset);
    expect(requests.some((url) => url.includes("/api/assets/virtual?"))).toBe(true);
    expect(requests.some((url) => /\/api\/assets(\?|$)/.test(url))).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });

  test("superinvestors route uses bounded virtual fetches and keeps only a small mounted window while scrolling", async () => {
    const page = await browser.newPage();
    const { requests, pageErrors, consoleErrors } = trackRequests(page);

    await page.goto(`${baseUrl}/superinvestors`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="zero-virtual-scroll-container"]');

    const initialRows = await getMountedVirtualRows(page);
    const firstVisibleCik = await page.locator('[data-row-index="0"] a').first().textContent();

    await page.locator('[data-testid="zero-virtual-scroll-container"]').evaluate((element) => {
      element.scrollTop = 5000;
    });
    await page.waitForTimeout(500);

    const rowsAfterScroll = await getMountedVirtualRows(page);
    const firstVisibleAfterScroll = await page.locator("[data-row-index] a").first().textContent();

    expect(initialRows).toBeLessThan(30);
    expect(rowsAfterScroll).toBeLessThan(30);
    expect(firstVisibleAfterScroll).not.toBe(firstVisibleCik);
    expect(requests.some((url) => url.includes("/api/superinvestors/virtual?"))).toBe(true);
    expect(requests.some((url) => /\/api\/superinvestors(\?|$)/.test(url))).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });
});
