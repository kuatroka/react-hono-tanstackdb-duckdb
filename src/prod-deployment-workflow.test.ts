import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");

function readProjectFile(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("production deployment automation", () => {
  test("exposes local production history scripts", () => {
    const packageJson = readProjectFile("package.json");

    expect(packageJson).toContain('"version": "');
    expect(packageJson).toContain('"prod:github:setup": "bun scripts/setup-prod-github.ts"');
    expect(packageJson).toContain('"prod:github:setup:dry-run": "bun scripts/setup-prod-github.ts --dry-run"');
    expect(packageJson).toContain('"prod:history": "bun scripts/prod-history.ts"');
    expect(packageJson).toContain('"prod:history:json": "bun scripts/prod-history.ts --format json"');
  });

  test("defines a production deploy workflow with tags, releases, and wiki updates", () => {
    const workflow = readProjectFile(".github/workflows/deploy-prod.yml");

    expect(workflow).toContain("name: Deploy to Production");
    expect(workflow).toContain("environment:");
    expect(workflow).toContain("name: prod");
    expect(workflow).toContain('echo "value=$(jq -r \'.version\' package.json)" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("id: metadata");
    expect(workflow).toContain('PROD_TAG="PROD-V-${APP_VERSION}-$(date -u +\'%Y%m%d-%H%M%S\')"');
    expect(workflow).toContain('export APP_GIT_COMMIT="${GITHUB_SHA}"');
    expect(workflow).toContain('PROD_TAG: ${{ needs.deploy.outputs.prod_tag }}');
    expect(workflow).toContain('git tag -a "$PROD_TAG" "$GITHUB_SHA"');
    expect(workflow).toContain('gh release create "$PROD_TAG"');
    expect(workflow).toContain("Production-Deployments.md");
    expect(workflow).toContain("bun run prod:history -- --output repo-wiki/Production-Deployments.md");
    expect(workflow).toContain("droid:prod-history:start");
  });

  test("documents the production tracking setup locally", () => {
    const doc = readProjectFile("ops/prod/README.md");

    expect(doc).toContain("Deploy to Production");
    expect(doc).toContain("bun run prod:github:setup");
    expect(doc).toContain("`prod` environment secrets");
    expect(doc).toContain("bun run prod:history");
    expect(doc).toContain("Production-Deployments");
    expect(doc).toContain("PROD_SSH_KEY");
  });

  test("includes a GitHub bootstrap helper for prod secrets and variables", () => {
    const helper = readProjectFile("scripts/setup-prod-github.ts");

    expect(helper).toContain('["gh", "api", "--method", "PUT"');
    expect(helper).toContain('"gh", "secret", "set"');
    expect(helper).toContain('"gh", "variable", "set"');
    expect(helper).toContain('const requiredSecrets: SecretName[] = ["PROD_HOST", "PROD_USER", "PROD_SSH_KEY"]');
  });

  test("supports both legacy and versioned prod tag history formats", () => {
    const historyScript = readProjectFile("scripts/prod-history.ts");

    expect(historyScript).toContain('const patterns = ["refs/tags/PROD-V-*", "refs/tags/prod-*"]');
    expect(historyScript).toContain("entries.sort((left, right) => right.deployedAt.localeCompare(left.deployedAt))");
  });

  test("passes deployment metadata into the production container", () => {
    const composeFile = readProjectFile("infra/prod/docker-compose.yml");

    expect(composeFile).toContain("APP_VERSION:");
    expect(composeFile).toContain("APP_GIT_COMMIT:");
    expect(composeFile).toContain("APP_PROD_TAG:");
    expect(composeFile).toContain("APP_DEPLOYED_AT:");
  });
});
