type SecretName =
  | "PROD_HOST"
  | "PROD_USER"
  | "PROD_SSH_KEY"
  | "PROD_PORT"
  | "PROD_DEPLOY_DIR";

type VariableName = "PROD_APP_URL";

interface CliOptions {
  repo: string | null;
  environment: string;
  dryRun: boolean;
}

const requiredSecrets: SecretName[] = ["PROD_HOST", "PROD_USER", "PROD_SSH_KEY"];
const optionalSecrets: SecretName[] = ["PROD_PORT", "PROD_DEPLOY_DIR"];
const optionalVariables: VariableName[] = ["PROD_APP_URL"];

function parseArgs(argv: string[]): CliOptions {
  let repo: string | null = process.env.GITHUB_REPOSITORY?.trim() || null;
  let environment = "prod";
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--repo" && argv[index + 1]) {
      repo = argv[index + 1];
      index += 1;
      continue;
    }

    if ((arg === "--env" || arg === "--environment") && argv[index + 1]) {
      environment = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { repo, environment, dryRun };
}

function runCommand(command: string[], options?: { dryRun?: boolean }) {
  if (options?.dryRun) {
    console.log(`[dry-run] ${command.join(" ")}`);
    return;
  }

  const result = Bun.spawnSync(command, {
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}`);
  }
}

function resolveRepositorySlug() {
  const remoteUrlResult = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (remoteUrlResult.exitCode !== 0) {
    return null;
  }

  const remoteUrl = remoteUrlResult.stdout.toString().trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match?.[1] ?? null;
}

function readEnvValue(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value : null;
}

function ensureEnvironment(repo: string, environment: string, dryRun: boolean) {
  runCommand(
    ["gh", "api", "--method", "PUT", `repos/${repo}/environments/${environment}`],
    { dryRun },
  );
}

function setEnvironmentSecret(repo: string, environment: string, name: SecretName, value: string, dryRun: boolean) {
  runCommand(
    ["gh", "secret", "set", name, "--repo", repo, "--env", environment, "--body", value],
    { dryRun },
  );
}

function setEnvironmentVariable(repo: string, environment: string, name: VariableName, value: string, dryRun: boolean) {
  runCommand(
    ["gh", "variable", "set", name, "--repo", repo, "--env", environment, "--body", value],
    { dryRun },
  );
}

function printUsageSummary(repo: string, environment: string, dryRun: boolean) {
  console.log(`Repository: ${repo}`);
  console.log(`Environment: ${environment}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repo = options.repo ?? resolveRepositorySlug();

  if (!repo) {
    throw new Error("Could not resolve GitHub repository slug. Pass --repo owner/name.");
  }

  printUsageSummary(repo, options.environment, options.dryRun);
  ensureEnvironment(repo, options.environment, options.dryRun);

  const missingRequiredSecrets = requiredSecrets.filter((name) => !readEnvValue(name));
  if (missingRequiredSecrets.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingRequiredSecrets.join(", ")}.\n` +
      "Export them locally, then rerun this command.",
    );
  }

  for (const name of requiredSecrets) {
    setEnvironmentSecret(repo, options.environment, name, readEnvValue(name)!, options.dryRun);
  }

  for (const name of optionalSecrets) {
    const value = readEnvValue(name);
    if (value) {
      setEnvironmentSecret(repo, options.environment, name, value, options.dryRun);
    }
  }

  for (const name of optionalVariables) {
    const value = readEnvValue(name);
    if (value) {
      setEnvironmentVariable(repo, options.environment, name, value, options.dryRun);
    }
  }

  console.log("Production GitHub environment setup complete.");
}

await main();
