import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";

const port = 4120;
const baseUrl = `http://127.0.0.1:${port}`;

let serverProcess: Bun.Subprocess;
let browser: Browser;

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

describe("asset detail browser smoke test", () => {
  beforeAll(async () => {
    serverProcess = Bun.spawn(["bun", "run", "dev"], {
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
    expect(await page.getByText("Investor Flow for BGRN").count()).toBeGreaterThan(0);

    const pageText = await page.locator("body").textContent();

    expect(pageText).toContain("TanStack DB");
    expect(pageText).not.toContain("React Query");

    await page.close();
  });

  test("shows render latency on the uPlot chart on asset detail", async () => {
    const page = await browser.newPage();
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Investor Activity for BGRN (uPlot)");

    const renderPartCount = await page.locator('[data-latency-part="render"]').count();

    expect(renderPartCount).toBeGreaterThanOrEqual(4);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  });

  test("shows render latency on the all-assets chart route", async () => {
    const page = await browser.newPage();
    const { pageErrors, consoleErrors } = trackPageIssues(page);

    await page.goto(`${baseUrl}/assets`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=All Assets Activity (ECharts)");
    await page.locator('[data-latency-part="render"]').first().waitFor();

    const pageText = await page.locator("body").textContent();

    expect(pageText).toContain("render:");
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
