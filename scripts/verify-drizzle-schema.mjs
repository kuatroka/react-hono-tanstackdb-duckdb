#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const failures = [];

const drizzleConfig = read("drizzle.config.ts");
const dockerCompose = read("docker/docker-compose.yml");
const schema = read("src/db/schema.ts");

if (!drizzleConfig.includes('out: "./drizzle"')) {
  failures.push('drizzle.config.ts must write the active migration chain to ./drizzle');
}

const forbiddenBootstrapMounts = [
  './seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro',
  './migrations/02_add_counter_quarters.sql',
  './migrations/03_add_entities.sql',
  './migrations/04_rollback_full_text_search.sql',
  './migrations/05_add_user_counters.sql',
  './migrations/06_add_searches.sql',
  './migrations/07_add_superinvestors_assets_periods.sql',
];

for (const mount of forbiddenBootstrapMounts) {
  if (dockerCompose.includes(mount)) {
    failures.push(`docker/docker-compose.yml still bootstraps schema via ${mount}`);
  }
}

const requiredTables = [
  "user",
  "medium",
  "message",
  "projects",
  "todos",
  "activity_summary",
  "cik_quarterly",
  "drilldown_activity",
  "investor_flow",
  "cusip_quarter_investor_activity",
  "cusip_quarter_investor_activity_detail",
];

for (const tableName of requiredTables) {
  const pattern = new RegExp(`pgTable\\(\\s*[\"']${tableName}[\"']`, "m");
  if (!pattern.test(schema)) {
    failures.push(`src/db/schema.ts is missing canonical table definition for ${tableName}`);
  }
}

const drizzleDir = new URL("drizzle/", root);
if (!existsSync(drizzleDir)) {
  failures.push('drizzle/ folder is missing');
} else {
  const requiredFiles = [
    '0000_melted_vivisector.sql',
    '0003_white_talos.sql',
    '0008_hot_brother_voodoo.sql',
    '0009_flat_speedball.sql',
    '0010_ensure_zero_sync_key.sql',
    'meta/_journal.json',
  ];
  for (const relativePath of requiredFiles) {
    if (!existsSync(join(drizzleDir.pathname, relativePath))) {
      failures.push(`drizzle/${relativePath} is missing`);
    }
  }
}

if (failures.length > 0) {
  console.error('Drizzle consolidation verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Drizzle consolidation layout verified.');
