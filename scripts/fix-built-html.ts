import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const indexHtmlPath = join(import.meta.dir, "..", "dist", "index.html");

const html = await readFile(indexHtmlPath, "utf8");
const rewrittenHtml = html
  .replace(/href="\.\//g, 'href="/')
  .replace(/src="\.\//g, 'src="/');

await writeFile(indexHtmlPath, rewrittenHtml);
console.log(`[fix-built-html] rewrote ${indexHtmlPath}`);
