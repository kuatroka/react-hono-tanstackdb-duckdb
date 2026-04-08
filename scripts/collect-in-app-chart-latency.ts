import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:4010";
const SUPERINVESTOR_PATH = process.env.SUPERINVESTOR_PATH ?? "/superinvestors/1054306";
const ASSET_PATH = process.env.ASSET_PATH ?? "/assets/GBNK/40075T102";
const RUNS = Number(process.env.RUNS ?? "5");

type BadgeSample = {
  label: string;
  dataMs: number | null;
  renderMs: number | null;
  source: string | null;
};

type RouteReport = {
  route: string;
  title: string;
  samples: BadgeSample[];
};

function parseMetric(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inferLabel(cardText: string, fallback: string): string {
  if (cardText.includes("Investor Activity for") && cardText.includes("(uPlot)")) {
    return "Investor Activity (uPlot)";
  }
  if (cardText.includes("Investor Activity for") && cardText.includes("(ECharts)")) {
    return "Investor Activity (ECharts)";
  }
  if (cardText.includes("Investor Flow for") && cardText.includes("(uPlot)")) {
    return "Investor Flow (uPlot)";
  }
  if (cardText.includes("Investor Flow for") && cardText.includes("(ECharts)")) {
    return "Investor Flow (ECharts)";
  }
  if (cardText.includes("Portfolio Value Over Time (ECharts)")) {
    return "Portfolio Value (ECharts)";
  }
  if (cardText.includes("Portfolio Value Over Time")) {
    return "Portfolio Value (uPlot)";
  }
  return fallback;
}

async function collectBadges(route: string): Promise<RouteReport> {
  const browser = await chromium.launch({ headless: true });
  try {
    const aggregate = new Map<string, { data: number[]; render: number[]; source: string | null }>();
    let title = route;

    for (let run = 0; run < RUNS; run += 1) {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];

      page.on("pageerror", (error) => {
        pageErrors.push(String(error));
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(`${APP_URL}${route}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(2500);

      title = await page.title();

      const badges = await page.locator('[data-testid="latency-badge"][data-latency-mode="inline"]').evaluateAll((nodes) => {
        return nodes.map((node) => {
          const element = node as HTMLElement;
          const card = element.closest('.rounded-xl, .rounded-lg, .rounded');
          const badgeText = element.textContent?.replace(/\s+/g, ' ').trim() ?? 'unknown';
          const cardText = card?.textContent?.replace(/\s+/g, ' ').trim() ?? badgeText;
          return {
            fallbackLabel: badgeText,
            cardText,
            dataMs: element.getAttribute('data-latency-data-ms'),
            renderMs: element.getAttribute('data-latency-render-ms'),
            source: element.getAttribute('data-latency-source'),
          };
        });
      });

      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        throw new Error(`Route ${route} produced browser errors. pageErrors=${JSON.stringify(pageErrors)} consoleErrors=${JSON.stringify(consoleErrors)}`);
      }

      for (const badge of badges) {
        const key = inferLabel(badge.cardText, badge.fallbackLabel);
        const entry = aggregate.get(key) ?? { data: [], render: [], source: badge.source ?? null };
        const dataMetric = parseMetric(badge.dataMs);
        const renderMetric = parseMetric(badge.renderMs);
        if (dataMetric != null) entry.data.push(dataMetric);
        if (renderMetric != null) entry.render.push(renderMetric);
        if (!entry.source && badge.source) entry.source = badge.source;
        aggregate.set(key, entry);
      }

      await page.close();
    }

    const samples: BadgeSample[] = Array.from(aggregate.entries()).map(([label, metrics]) => ({
      label,
      dataMs: average(metrics.data),
      renderMs: average(metrics.render),
      source: metrics.source,
    }));

    return { route, title, samples };
  } finally {
    await browser.close();
  }
}

function printReport(report: RouteReport) {
  console.log(`\n# ${report.route}`);
  console.log(`title: ${report.title}`);
  for (const sample of report.samples) {
    console.log(
      JSON.stringify({
        label: sample.label,
        dataMs: sample.dataMs != null ? Number(sample.dataMs.toFixed(2)) : null,
        renderMs: sample.renderMs != null ? Number(sample.renderMs.toFixed(2)) : null,
        source: sample.source,
      }),
    );
  }
}

const reports = await Promise.all([
  collectBadges(SUPERINVESTOR_PATH),
  collectBadges(ASSET_PATH),
]);

for (const report of reports) {
  printReport(report);
}
