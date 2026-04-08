import { test, expect } from "bun:test";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseAverage(resultsText: string, chartName: "ECharts" | "uPlot"): number {
  const regex = new RegExp(`${chartName} Performance[\\s\\S]*?Average:\\s+([0-9.]+)ms`);
  const match = resultsText.match(regex);
  if (!match) {
    throw new Error(`Could not parse ${chartName} average from benchmark output:\n${resultsText}`);
  }

  return Number(match[1]);
}

test(
  "chart benchmark favors ECharts over uPlot for large datasets",
  async () => {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      const htmlPath = join(__dirname, "benchmark-chart-rendering.html");
      const fileUrl = `file://${htmlPath}`;

      await page.goto(fileUrl);
      await page.selectOption("#dataPoints", "5000");
      await page.selectOption("#iterations", "20");
      await page.click("#runBenchmark");
      await page.waitForSelector(".status.complete", { timeout: 120000 });

      const resultsText = await page.locator("#results pre").innerText();
      const echartsAverage = parseAverage(resultsText, "ECharts");
      const uplotAverage = parseAverage(resultsText, "uPlot");

      expect(echartsAverage).toBeLessThan(uplotAverage);
    } finally {
      await browser.close();
    }
  },
  150000,
);
