import { readFileSync } from "node:fs";
import { join } from "node:path";

interface PackageJson {
  name?: string;
  version?: string;
}

export interface BuildMetadata {
  service: string;
  appVersion: string;
  gitCommit: string | null;
  gitCommitShort: string | null;
  prodTag: string | null;
  deployedAt: string | null;
}

const projectRoot = join(import.meta.dir, "..");
const packageJson = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
) as PackageJson;

const service = packageJson.name?.trim() || "react-hono-tanstackdb-duckdb";
const appVersion = packageJson.version?.trim() || "0.0.0";
const gitCommit = process.env.APP_GIT_COMMIT?.trim() || null;

export const buildMetadata: BuildMetadata = {
  service,
  appVersion: process.env.APP_VERSION?.trim() || appVersion,
  gitCommit,
  gitCommitShort: gitCommit ? gitCommit.slice(0, 7) : null,
  prodTag: process.env.APP_PROD_TAG?.trim() || null,
  deployedAt: process.env.APP_DEPLOYED_AT?.trim() || null,
};

export function withBuildMetadataHeaders(response: Response) {
  const headers = new Headers(response.headers);

  headers.set("x-app-version", buildMetadata.appVersion);

  if (buildMetadata.gitCommit) {
    headers.set("x-git-commit", buildMetadata.gitCommit);
  }

  if (buildMetadata.prodTag) {
    headers.set("x-prod-tag", buildMetadata.prodTag);
  }

  if (buildMetadata.deployedAt) {
    headers.set("x-deployed-at", buildMetadata.deployedAt);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
