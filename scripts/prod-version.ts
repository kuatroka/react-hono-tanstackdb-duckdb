interface RawProdTagEntry {
  tag: string;
  deployedAt: string;
  commit: string;
  subject: string;
}

export interface VersionedProdTagEntry extends RawProdTagEntry {
  version: string;
}

const VERSION_PREFIX = "0.1.";

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

function parseTagVersion(tag: string) {
  const match = tag.match(/^PROD-V-(\d+\.\d+\.\d+)-\d{8}-\d{6}$/);
  return match?.[1] ?? null;
}

function parseManagedPatch(version: string) {
  const match = version.match(/^0\.1\.(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function listProdTags() {
  const patterns = ["refs/tags/prod-*", "refs/tags/PROD-V-*"];
  const seenTags = new Set<string>();
  const entries: RawProdTagEntry[] = [];

  for (const pattern of patterns) {
    const output = runGit([
      "git",
      "for-each-ref",
      "--sort=taggerdate",
      "--format=%(refname:short)%09%(taggerdate:iso8601-strict)%09%(*objectname)%09%(subject)",
      pattern,
    ]);

    if (!output) {
      continue;
    }

    for (const line of output.split("\n")) {
      const [tag, deployedAt, commit, subject] = line.split("\t");
      if (!tag || !commit || seenTags.has(tag)) {
        continue;
      }

      seenTags.add(tag);
      entries.push({ tag, deployedAt, commit, subject });
    }
  }

  return entries.sort((left, right) => left.deployedAt.localeCompare(right.deployedAt));
}

export function versionProdTags(entries: RawProdTagEntry[]): VersionedProdTagEntry[] {
  let nextPatch = 0;

  return entries.map((entry) => {
    const explicitVersion = parseTagVersion(entry.tag);
    if (explicitVersion && explicitVersion !== "0.0.0") {
      const managedPatch = parseManagedPatch(explicitVersion);
      if (managedPatch !== null) {
        nextPatch = Math.max(nextPatch, managedPatch + 1);
      }

      return {
        ...entry,
        version: explicitVersion,
      };
    }

    const version = `${VERSION_PREFIX}${nextPatch}`;
    nextPatch += 1;

    return {
      ...entry,
      version,
    };
  });
}

export function getNextProdVersion() {
  const entries = versionProdTags(listProdTags());
  if (entries.length === 0) {
    return `${VERSION_PREFIX}0`;
  }

  const patches = entries
    .map((entry) => parseManagedPatch(entry.version))
    .filter((value): value is number => value !== null);

  const nextPatch = patches.length === 0 ? 0 : Math.max(...patches) + 1;
  return `${VERSION_PREFIX}${nextPatch}`;
}

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode === "--next") {
    process.stdout.write(`${getNextProdVersion()}\n`);
  } else if (mode === "--json") {
    process.stdout.write(`${JSON.stringify(versionProdTags(listProdTags()), null, 2)}\n`);
  } else {
    process.stdout.write("Usage: bun scripts/prod-version.ts --next|--json\n");
    process.exit(1);
  }
}
