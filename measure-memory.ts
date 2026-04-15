import { chromium } from "playwright";
import { execSync } from "child_process";

async function run() {
  const browser = await chromium.launch({ 
    headless: false, // run headed to be closer to user experience
    args: ['--js-flags="--expose-gc"'] 
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Connect to CDP
  const client = await page.context().newCDPSession(page);
  const browserClient = await browser.newBrowserCDPSession();

  async function getTabMemory() {
    // 1. Force GC to get a clean baseline
    await client.send('HeapProfiler.enable');
    await client.send('HeapProfiler.collectGarbage');
    
    // 2. JS Heap Memory
    const heap = await page.evaluate(() => {
      const p = (window.performance as any).memory;
      return p ? { used: p.usedJSHeapSize, total: p.totalJSHeapSize } : null;
    });

    // 3. Process Memory (OS level for the renderer process)
    const processInfo = await browserClient.send('SystemInfo.getProcessInfo');
    const rendererProcess = processInfo.processInfo.find((p: any) => p.type === 'renderer');
    
    let osMemory = 0;
    if (rendererProcess && rendererProcess.id) {
        try {
            // Get RSS (Resident Set Size) in KB, convert to MB
            const rssKb = execSync(`ps -o rss= -p ${rendererProcess.id}`).toString().trim();
            osMemory = parseInt(rssKb, 10) / 1024;
        } catch (e) {
            // Ignore if process not found or ps fails
        }
    }

    // 4. DOM Nodes
    const dom = await client.send('Memory.getDOMCounters');

    return {
      heapUsedMb: heap ? Math.round(heap.used / 1024 / 1024) : 0,
      osMemoryMb: Math.round(osMemory),
      domNodes: dom.nodes,
      jsEventListeners: dom.jsEventListeners
    };
  }

  console.log("Navigating to page...");
  await page.goto("http://127.0.0.1:4230/assets/BGRN/46435U440", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  console.log("Load 1:", await getTabMemory());

  console.log("Reloading...");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  console.log("Load 2:", await getTabMemory());

  console.log("Reloading...");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  console.log("Load 3:", await getTabMemory());

  console.log("Reloading...");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  console.log("Load 4:", await getTabMemory());

  await browser.close();
}

run().catch(console.error);
