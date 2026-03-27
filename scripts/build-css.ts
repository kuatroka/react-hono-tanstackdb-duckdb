import { mkdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { dirname, join } from "node:path";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const projectRoot = join(import.meta.dir, "..");
const inputPath = join(projectRoot, "src", "index.css");
const outputPath = join(projectRoot, "index.compiled.css");
const watchTargets = [
  join(projectRoot, "src"),
  join(projectRoot, "app"),
  join(projectRoot, "index.html"),
  join(projectRoot, "tailwind.config.js"),
  join(projectRoot, "postcss.config.js"),
  join(projectRoot, "components.json"),
];

async function buildCss() {
  const input = await readFile(inputPath, "utf8");
  const result = await postcss([tailwindcss(), autoprefixer]).process(input, {
    from: inputPath,
    to: outputPath,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.css);
  console.log(`[build-css] wrote ${outputPath}`);
}

async function main() {
  await buildCss();

  if (!process.argv.includes("--watch")) {
    return;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const scheduleBuild = (filename?: string | null) => {
    if (filename?.endsWith("index.compiled.css")) {
      return;
    }

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      buildCss().catch((error: unknown) => {
        console.error("[build-css] rebuild failed", error);
      });
    }, 50);
  };

  for (const target of watchTargets) {
    watch(target, { recursive: true }, (_, filename) => scheduleBuild(filename));
  }

  console.log("[build-css] watching for changes");
}

main().catch((error: unknown) => {
  console.error("[build-css] failed", error);
  process.exitCode = 1;
});
