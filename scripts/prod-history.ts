type OutputFormat = "markdown" | "json";

interface ProdEntry {
  tag: string;
  deployedAt: string;
  commit: string;
  commitShort: string;
  commitSubject: string;
  commitAuthor: string;
  commitDate: string;
  releaseUrl: string | null;
}

function parseArgs(argv: string[]) {
  let format: OutputFormat = "markdown";
  let outputPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--format" && argv[index + 1]) {
      const next = argv[index + 1];
      if (next === "markdown" || next === "json") {
        format = next;
      }
      index += 1;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      outputPath = argv[index + 1];
      index += 1;
    }
  }

  return { format, outputPath };
}

function runGit(command: string[]) {
  const result = Bun.spawnSync(command, {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new Error(stderr || `Git command failed: ${command.join(" ")}`);
  }

  return result.stdout.toString().trim();
}

function resolveRepositorySlug() {
  const fromEnv = process.env.GITHUB_REPOSITORY?.trim();
  if (fromEnv) return fromEnv;

  const remoteUrl = runGit(["git", "remote", "get-url", "origin"]).trim();
  const sshMatch = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return sshMatch?.[1] ?? null;
}

function listProdTags() {
  const patterns = ["refs/tags/PROD-V-*", "refs/tags/prod-*"];
  const seenTags = new Set<string>();
  const entries: Array<{ tag: string; deployedAt: string; commit: string; subject: string }> = [];

  for (const pattern of patterns) {
    const output = runGit([
      "git",
      "for-each-ref",
      "--sort=-taggerdate",
      "--format=%(refname:short)%09%(taggerdate:iso8601-strict)%09%(*objectname)%09%(subject)",
      pattern,
    ]);

    if (!output) {
      continue;
    }

    for (const line of output.split("\n")) {
      const [tag, deployedAt, peeledCommit, subject] = line.split("\t");
      if (!tag || !peeledCommit || seenTags.has(tag)) {
        continue;
      }

      seenTags.add(tag);
      entries.push({
        tag,
        deployedAt,
        commit: peeledCommit,
        subject,
      });
    }
  }

  return entries.sort((left, right) => right.deployedAt.localeCompare(left.deployedAt));
}

function readCommitMetadata(commit: string) {
  const output = runGit([
    "git",
    "show",
    "-s",
    "--format=%H%x09%h%x09%cI%x09%an%x09%s",
    commit,
  ]);

  const [fullHash, shortHash, commitDate, commitAuthor, commitSubject] = output.split("\t");
  return {
    fullHash,
    shortHash,
    commitDate,
    commitAuthor,
    commitSubject,
  };
}

function buildEntries(): ProdEntry[] {
  const repoSlug = resolveRepositorySlug();
  return listProdTags().map((entry) => {
    const commitMeta = readCommitMetadata(entry.commit);
    return {
      tag: entry.tag,
      deployedAt: entry.deployedAt,
      commit: commitMeta.fullHash,
      commitShort: commitMeta.shortHash,
      commitSubject: commitMeta.commitSubject,
      commitAuthor: commitMeta.commitAuthor,
      commitDate: commitMeta.commitDate,
      releaseUrl: repoSlug ? `https://github.com/${repoSlug}/releases/tag/${entry.tag}` : null,
    };
  });
}

function renderMarkdown(entries: ProdEntry[]) {
  const generatedAt = new Date().toISOString();
  const lines = [
    "# Production deployment history",
    "",
    `Generated at: ${generatedAt}`,
    "",
    `Total deployments: ${entries.length}`,
    "",
    "| Tag | Deployed at | Commit | Author | Commit date | Subject | Release |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const entry of entries) {
    lines.push(
      `| \`${entry.tag}\` | ${entry.deployedAt} | \`${entry.commitShort}\` | ${entry.commitAuthor} | ${entry.commitDate} | ${entry.commitSubject.replaceAll("|", "\\|")} | ${entry.releaseUrl ? `[link](${entry.releaseUrl})` : "—"} |`,
    );
  }

  if (entries.length === 0) {
    lines.push("| — | — | — | — | — | No production deployments recorded yet. | — |");
  }

  lines.push("", "## Local usage", "", "```bash", "bun run prod:history", "bun run prod:history:json", "```");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const { format, outputPath } = parseArgs(process.argv.slice(2));
  const entries = buildEntries();
  const rendered = format === "json"
    ? `${JSON.stringify(entries, null, 2)}\n`
    : renderMarkdown(entries);

  if (outputPath) {
    await Bun.write(outputPath, rendered);
    return;
  }

  process.stdout.write(rendered);
}

await main();
