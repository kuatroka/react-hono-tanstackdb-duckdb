import { chromium, type Browser, type Page } from "playwright";

const BASE_URL = "http://localhost:5173";
const ITERATIONS = 10;

interface PerformanceMetrics {
  label: string;
  navigationTime: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
}

interface ChartRenderMetrics {
  label: string;
  dataFetchTime: number;
  chartRenderTime: number;
  totalTime: number;
  rowCount: number;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function measurePageLoad(page: Page, url: string): Promise<PerformanceMetrics> {
  await page.goto(url, { waitUntil: "networkidle" });

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType("paint");
    
    const firstPaint = paint.find((p) => p.name === "first-paint")?.startTime || 0;
    const firstContentfulPaint = paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0;

    return {
      navigationTime: navigation.responseEnd - navigation.requestStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint,
      firstContentfulPaint,
      largestContentfulPaint: 0,
      totalBlockingTime: 0,
      cumulativeLayoutShift: 0,
    };
  });

  return {
    label: url,
    ...metrics,
  };
}

async function measureChartRendering(
  page: Page,
  url: string,
  chartSelector: string
): Promise<ChartRenderMetrics> {
  const startTime = Date.now();

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const dataFetchStart = Date.now();
  
  // Wait for chart container to be visible
  await page.waitForSelector(chartSelector, { state: "visible", timeout: 10000 });
  
  const dataFetchTime = Date.now() - dataFetchStart;

  // Wait for chart to actually render (check for canvas or svg)
  const chartRenderStart = Date.now();
  await page.waitForFunction(
    (selector) => {
      const container = document.querySelector(selector);
      if (!container) return false;
      
      // Check for ECharts canvas
      const canvas = container.querySelector("canvas");
      if (canvas) return true;
      
      // Check for uPlot canvas
      const uplotCanvas = container.querySelector(".uplot canvas");
      if (uplotCanvas) return true;
      
      // Check for SVG (Recharts)
      const svg = container.querySelector("svg");
      if (svg) return true;
      
      return false;
    },
    chartSelector,
    { timeout: 10000 }
  );
  
  const chartRenderTime = Date.now() - chartRenderStart;
  const totalTime = Date.now() - startTime;

  // Try to get row count from latency badge or data
  const rowCount = await page.evaluate(() => {
    const badge = document.querySelector('[data-testid="latency-badge"]');
    if (badge) {
      const text = badge.textContent || "";
      const match = text.match(/(\d+)\s*rows/);
      if (match) return parseInt(match[1]);
    }
    return 0;
  });

  return {
    label: url,
    dataFetchTime,
    chartRenderTime,
    totalTime,
    rowCount,
  };
}

async function benchmarkPage(
  browser: Browser,
  label: string,
  url: string,
  chartSelector?: string
): Promise<void> {
  console.log(`\n📊 ${label}`);
  console.log(`   URL: ${url}`);

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (chartSelector) {
      // Benchmark chart rendering
      const times: number[] = [];
      const dataFetchTimes: number[] = [];
      const chartRenderTimes: number[] = [];
      let lastRowCount = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const metrics = await measureChartRendering(page, url, chartSelector);
        times.push(metrics.totalTime);
        dataFetchTimes.push(metrics.dataFetchTime);
        chartRenderTimes.push(metrics.chartRenderTime);
        lastRowCount = metrics.rowCount;

        // Clear cache between iterations
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      }

      const avgTotal = times.reduce((a, b) => a + b, 0) / times.length;
      const avgDataFetch = dataFetchTimes.reduce((a, b) => a + b, 0) / dataFetchTimes.length;
      const avgChartRender = chartRenderTimes.reduce((a, b) => a + b, 0) / chartRenderTimes.length;

      console.log(`   Rows: ${lastRowCount.toLocaleString()}`);
      console.log(`   Chart Selector: ${chartSelector}`);
      console.log("┌──────────────────┬──────────┬──────────┬──────────┐");
      console.log("│      Metric      │   Avg    │   Min    │   Max    │");
      console.log("├──────────────────┼──────────┼──────────┼──────────┤");
      console.log(
        `│ Data Fetch       │ ${formatMs(avgDataFetch).padStart(8)} │ ${formatMs(Math.min(...dataFetchTimes)).padStart(8)} │ ${formatMs(Math.max(...dataFetchTimes)).padStart(8)} │`
      );
      console.log(
        `│ Chart Render     │ ${formatMs(avgChartRender).padStart(8)} │ ${formatMs(Math.min(...chartRenderTimes)).padStart(8)} │ ${formatMs(Math.max(...chartRenderTimes)).padStart(8)} │`
      );
      console.log(
        `│ Total Time       │ ${formatMs(avgTotal).padStart(8)} │ ${formatMs(Math.min(...times)).padStart(8)} │ ${formatMs(Math.max(...times)).padStart(8)} │`
      );
      console.log("└──────────────────┴──────────┴──────────┴──────────┘");
    } else {
      // Benchmark page load
      const metrics: PerformanceMetrics[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const metric = await measurePageLoad(page, url);
        metrics.push(metric);

        // Clear cache between iterations
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      }

      const avgNav = metrics.reduce((a, b) => a + b.navigationTime, 0) / metrics.length;
      const avgDom = metrics.reduce((a, b) => a + b.domContentLoaded, 0) / metrics.length;
      const avgLoad = metrics.reduce((a, b) => a + b.loadComplete, 0) / metrics.length;
      const avgFCP = metrics.reduce((a, b) => a + b.firstContentfulPaint, 0) / metrics.length;

      console.log("┌──────────────────────┬──────────┐");
      console.log("│       Metric         │   Avg    │");
      console.log("├──────────────────────┼──────────┤");
      console.log(`│ Navigation Time      │ ${formatMs(avgNav).padStart(8)} │`);
      console.log(`│ DOM Content Loaded   │ ${formatMs(avgDom).padStart(8)} │`);
      console.log(`│ Load Complete        │ ${formatMs(avgLoad).padStart(8)} │`);
      console.log(`│ First Contentful Paint│ ${formatMs(avgFCP).padStart(8)} │`);
      console.log("└──────────────────────┴──────────┘");
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("🏁 Playwright Performance Profiling");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Iterations: ${ITERATIONS}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Test if server is running
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(BASE_URL, { timeout: 5000 });
    } catch (error) {
      console.error("❌ Server not running! Please start the server with 'bun run dev'");
      await context.close();
      await browser.close();
      process.exit(1);
    }
    await context.close();

    // 1. Page Load Performance
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("📄 PAGE LOAD PERFORMANCE");
    console.log("═══════════════════════════════════════════════════════");

    await benchmarkPage(browser, "Home Page", `${BASE_URL}/`);
    await benchmarkPage(browser, "Assets Table", `${BASE_URL}/assets`);
    await benchmarkPage(browser, "Superinvestors Table", `${BASE_URL}/superinvestors`);

    // 2. Chart Rendering Performance
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("📈 CHART RENDERING PERFORMANCE");
    console.log("═══════════════════════════════════════════════════════");

    // Asset Detail page with ECharts
    await benchmarkPage(
      browser,
      "Asset Detail - ECharts (AAPL)",
      `${BASE_URL}/assets/037833100`,
      '[data-chart-type="echarts"]'
    );

    // Asset Detail page with uPlot
    await benchmarkPage(
      browser,
      "Asset Detail - uPlot (AAPL)",
      `${BASE_URL}/assets/037833100`,
      '[data-chart-type="uplot"]'
    );

    // Superinvestor Detail page
    await benchmarkPage(
      browser,
      "Superinvestor Detail (Berkshire)",
      `${BASE_URL}/superinvestors/1067983`,
      '[data-chart-type="echarts"]'
    );

    // 3. Drilldown Table Performance
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("🔍 DRILLDOWN TABLE PERFORMANCE");
    console.log("═══════════════════════════════════════════════════════");

    await benchmarkPage(
      browser,
      "Drilldown Table (AAPL)",
      `${BASE_URL}/assets/037833100`,
      '[data-testid="drilldown-table"]'
    );

    console.log("\n✅ Profiling complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
