import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright";

const port = 4120;
const baseUrl = `http://127.0.0.1:${port}`;

let serverProcess: Bun.Subprocess;
let browser: Browser;

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
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleErrors.push(`[${message.type()}] ${message.text()}`);
      }
    });

    await page.goto(`${baseUrl}/assets/BGRN/46435U440`, { waitUntil: "networkidle" });

    expect(await page.getByText("Something went wrong!").count()).toBe(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

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
});
