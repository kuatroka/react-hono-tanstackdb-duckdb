import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3001/assets";
const waitMs = Number.parseInt(process.argv[3] ?? "4000", 10);

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});
page.on("pageerror", (error) => {
  pageErrors.push(String(error));
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(waitMs);

  const result = await page.evaluate(() => {
    const rootChild = document.querySelector("#root > *") as HTMLElement | null;
    const navLinks = Array.from(document.querySelectorAll("nav a")) as HTMLAnchorElement[];
    const assetsLink = navLinks.find((link) => link.textContent?.trim() === "Assets") ?? null;
    const text = document.body.innerText.replace(/\s+/g, " ").trim();

    const visibilityOf = (element: Element | null) => {
      if (!element) return null;
      const style = getComputedStyle(element as HTMLElement);
      const rect = (element as HTMLElement).getBoundingClientRect();
      return {
        visibility: style.visibility,
        display: style.display,
        opacity: style.opacity,
        width: rect.width,
        height: rect.height,
      };
    };

    const root = visibilityOf(rootChild);
    const assets = visibilityOf(assetsLink);
    const navVisible = Boolean(
      assets &&
        assets.visibility !== "hidden" &&
        assets.display !== "none" &&
        assets.opacity !== "0" &&
        assets.width > 0 &&
        assets.height > 0,
    );

    return {
      url: location.href,
      root,
      assets,
      navVisible,
      textSnippet: text.slice(0, 300),
      hasMeaningfulText: text.length > 0,
    };
  });

  const pass = Boolean(
    result.root &&
      result.root.visibility !== "hidden" &&
      result.navVisible &&
      result.hasMeaningfulText,
  );

  console.log(JSON.stringify({ pass, result, consoleErrors, pageErrors }, null, 2));

  if (!pass) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
