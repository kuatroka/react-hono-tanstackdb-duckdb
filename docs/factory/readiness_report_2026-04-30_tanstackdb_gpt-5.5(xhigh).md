# Agent Readiness Report: react-hono-tanstackdb-duckdb

**Level:** 3/5
**Overall Score:** 42%
**Generated:** 2026-04-30 15:54:57 UTC
**Commit:** `3474ccc`
**Branch:** main

## Summary

| Metric | Value |
|--------|-------|
| Total Criteria | 82 |
| Passed | 31 |
| Failed | 43 |
| Skipped | 8 |

## Pass Rate by Category

| Category | Pass Rate |
|----------|-----------|
| Style & Validation | 23% |
| Build System | 57% |
| Testing | 63% |
| Documentation | 75% |
| Development Environment | 67% |
| Debugging & Observability | 40% |
| Security | 17% |
| Task Discovery | 25% |
| Product & Experimentation | 0% |

## Style & Validation

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Code Formatter | 0/1 | 🔴 Failed | No Prettier, Biome, or other formatter config found. |
| Pre-commit Hooks | 0/1 | 🔴 Failed | No Husky, lint-staged, or .pre-commit-config.yaml hooks found. |
| Naming Consistency | 0/1 | 🔴 Failed | No enforced naming-convention ESLint rule or documented naming policy found in root docs. |
| Cyclomatic Complexity | 0/1 | 🔴 Failed | No ESLint complexity rule, Sonar, or equivalent complexity analysis tooling found. |
| Large File Detection | 0/1 | 🔴 Failed | No file-size hooks, LFS .gitattributes, max-lines rule, or CI large-file guard found. |
| Dead Code Detection | 0/1 | 🔴 Failed | No dedicated dead export/module detector such as knip, unimported, or import/no-unused-modules found. |
| Duplicate Code Detection | 0/1 | 🔴 Failed | No jscpd, Sonar CPD, PMD CPD, or equivalent duplicate-code detection found. |
| Code Modularization Enforcement | 0/1 | 🔴 Failed | No dependency-cruiser, eslint boundaries/no-restricted-paths, Nx boundaries, or architecture fitness checks found. |
| Technical Debt Tracking | 0/1 | 🔴 Failed | No TODO/FIXME scanner, issue-linked TODO enforcement, or technical-debt quality platform found. |
| N+1 Query Detection | 0/1 | 🔴 Failed | The app uses database-backed API routes, but no N+1 query detector, query-analysis tests, or APM slow-query tooling was found. |
| Linter Configuration | 1/1 | 🟢 Passed | ESLint is configured at repo root in eslint.config.js and package.json exposes bun run lint. |
| Type Checker | 1/1 | 🟢 Passed | TypeScript configs exist; tsconfig.app.json and tsconfig.node.json enable strict compiler options. |
| Strict Typing | 1/1 | 🟢 Passed | TypeScript strict mode is enabled in both app and node tsconfig files. |

## Build System

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Automated PR Review Generation | 0/1 | 🔴 Failed | GitHub CLI is authenticated, but recent PR metadata had no bot reviews/comments and no Danger/Droid review workflow was found. |
| Fast CI Feedback | 0/1 | 🔴 Failed | Authenticated gh PR lookup found no PR status checks to measure; CI appears push/deploy-oriented rather than PR feedback. |
| Build Performance Tracking | 0/1 | 🔴 Failed | No build duration tracking, cache metrics, turbo/nx cache, or explicit build-performance monitoring found. |
| Feature Flag Infrastructure | 0/1 | 🔴 Failed | No LaunchDarkly, Statsig, Unleash, GrowthBook, or custom feature-flag system was found. |
| Heavy Dependency Detection | 0/1 | 🔴 Failed | Frontend is bundled, but no bundle analyzer, size-limit, bundlewatch, Lighthouse CI, or size budget was found. |
| Unused Dependencies Detection | 0/1 | 🔴 Failed | No depcheck, knip, npm-check, or CI check for unused dependencies found. |
| Build Command Documentation | 1/1 | 🟢 Passed | README documents bun install, bun run dev, bun run build, and bun run start. |
| Dependencies Pinned | 1/1 | 🟢 Passed | bun.lock is committed and package install in CI uses bun install --frozen-lockfile. |
| VCS CLI Tools | 1/1 | 🟢 Passed | GitHub CLI is installed and gh auth status reports an authenticated account. |
| Agentic Development | 1/1 | 🟢 Passed | Git history includes factory-droid[bot] co-authorship and repo-local agent/skill configuration directories exist. |
| Deployment Frequency | 1/1 | 🟢 Passed | GitHub releases and workflow runs show many successful production deploys in April 2026, including multiple per week. |
| Single Command Setup | 1/1 | 🟢 Passed | README provides a short fresh-clone sequence: bun install then bun run dev. |
| Release Notes Automation | 1/1 | 🟢 Passed | deploy-prod workflow creates GitHub releases with generated release notes for production tags. |
| Release Automation | 1/1 | 🟢 Passed | GitHub Actions deploy-prod workflow validates, deploys to VPS, creates production tags, and creates releases. |
| Progressive Rollout | N/A | Skipped | Skipped: repository is an application repo, not a dedicated infrastructure rollout repo. |
| Rollback Automation | N/A | Skipped | Skipped: repository is not primarily an infrastructure repo with rollout/rollback controls. |
| Monorepo Tooling | N/A | Skipped | Skipped: application discovery identified a single root application, not a monorepo. |
| Version Drift Detection | N/A | Skipped | Skipped: single-package repository, so monorepo version drift is not applicable. |
| Dead Feature Flag Detection | N/A | Skipped | Skipped: feature flag infrastructure is not configured. |

## Testing

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Test Performance Tracking | 0/1 | 🔴 Failed | No CI test timing artifacts, test analytics, JUnit timing upload, or duration tracking configuration found. |
| Flaky Test Detection | 0/1 | 🔴 Failed | No retry/quarantine configuration is used in scripts or CI, and PR status checks did not expose flake/retry evidence. |
| Test Coverage Thresholds | 0/1 | 🔴 Failed | No coverageThreshold, --coverage gate, Codecov/Coveralls quality gate, or coverage fail-under policy found. |
| Unit Tests Exist | 1/1 | 🟢 Passed | Many Bun test files exist across src/, api/, and app/ with *.test.ts/tsx naming. |
| Integration Tests Exist | 1/1 | 🟢 Passed | Integration and browser-smoke tests exist, including api/*.integration.test.ts and app/asset-detail-browser-smoke.test.ts. |
| Unit Tests Runnable | 1/1 | 🟢 Passed | bun test discovery ran successfully with a non-matching filter and exited 0 after scanning 46 test files. |
| Test File Naming Conventions | 1/1 | 🟢 Passed | Test files consistently use *.test.ts/tsx and test:ci explicitly selects *.test.ts files with rg globs. |
| Test Isolation | 1/1 | 🟢 Passed | Bun test runner defaults to concurrent execution with max concurrency, and the suite includes concurrent behavior tests. |

## Documentation

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| API Schema Docs | 0/1 | 🔴 Failed | The app exposes Hono HTTP APIs, but no OpenAPI/Swagger/GraphQL schema file was found. |
| AGENTS.md Freshness Validation | 0/1 | 🔴 Failed | No CI job, pre-commit hook, doc test, or generator validates AGENTS.md commands or freshness. |
| AGENTS.md File | 1/1 | 🟢 Passed | Root AGENTS.md exists and is non-empty with autonomous-agent workflow and testing guidance. |
| README File | 1/1 | 🟢 Passed | Root README.md exists with stack, structure, setup, build, run, and benchmark instructions. |
| Automated Documentation Generation | 1/1 | 🟢 Passed | deploy-prod workflow generates production history docs and updates GitHub wiki/release notes automatically. |
| Skills Configuration | 1/1 | 🟢 Passed | .factory/skills/implementation-notes/SKILL.md and other skill directories contain valid YAML frontmatter with name/description. |
| Documentation Freshness | 1/1 | 🟢 Passed | git log shows README.md/AGENTS.md changes within the last 180 days. |
| Service Architecture Documented | 1/1 | 🟢 Passed | docs/DUCKDB-INTEGRATION.md and docs/CURRENT-STATE.md document Hono, DuckDB, TanStack DB, and data flow. |

## Development Environment

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Dev Container | 0/1 | 🔴 Failed | No .devcontainer/devcontainer.json was found. |
| Environment Template | 1/1 | 🟢 Passed | infra/prod/.env.example documents required production/runtime environment variables. |
| Database Schema | 1/1 | 🟢 Passed | src/lib/dexie-db.ts defines client IndexedDB tables and src/types/duckdb.ts documents DuckDB response/data types. |
| Local Services Setup | N/A | Skipped | Skipped: current README states there is no separate bootstrap database workflow for normal development. |
| Devcontainer Runnable | N/A | Skipped | Skipped: devcontainer CLI is not installed and no devcontainer config exists to run. |

## Debugging & Observability

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Distributed Tracing | 0/1 | 🔴 Failed | No OpenTelemetry, traceparent, X-Request-ID propagation, or request-id middleware found. |
| Code Quality Metrics Dashboard | 0/1 | 🔴 Failed | GitHub code-scanning API reported no analyses and no coverage/maintainability platform or PR coverage bot was found. |
| Error Tracking Contextualized | 0/1 | 🔴 Failed | No Sentry, Bugsnag, Rollbar, source-map upload, breadcrumbs, or contextual error tracking found. |
| Alerting Configured | 0/1 | 🔴 Failed | No PagerDuty, OpsGenie, alert rules, or custom alerting configuration found. |
| Runbooks Documented | 0/1 | 🔴 Failed | ops/prod documents deployment tracking, but no incident runbook/playbook or external runbook pointer was found. |
| Deployment Observability | 0/1 | 🔴 Failed | Deployment history is recorded, but no monitoring dashboard, deploy-impact reference, Slack notification, or annotation integration was found. |
| Structured Logging | 1/1 | 🟢 Passed | api/db/logging.ts provides dedicated event/warning/error logging helpers with structured payload objects. |
| Metrics Collection | 1/1 | 🟢 Passed | api/db/metrics.ts records bounded metrics and /api/db-status exposes metric summaries. |
| Health Checks | 1/1 | 🟢 Passed | api/server.ts implements a production /healthz endpoint returning ok and build metadata. |
| Profiling Instrumentation | 1/1 | 🟢 Passed | react-scan is included for render profiling and measure-memory.ts/benchmark profiling scripts support local performance profiling. |
| Circuit Breakers | N/A | Skipped | Skipped: no external runtime service dependency was identified where circuit breaking would apply. |

## Security

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Branch Protection | 0/1 | 🔴 Failed | Admin gh API access confirmed, but rulesets were empty and main branch protection returned 404. |
| CODEOWNERS File | 0/1 | 🔴 Failed | No CODEOWNERS file exists in root or .github/. |
| Automated Security Review Generation | 0/1 | 🔴 Failed | GitHub code-scanning endpoints reported no analyses and no security review report automation was found. |
| Dependency Update Automation | 0/1 | 🔴 Failed | No Dependabot, Renovate, or similar dependency update automation config found. |
| Gitignore Comprehensive | 0/1 | 🔴 Failed | .gitignore excludes node_modules/build artifacts, but does not ignore .env and .env is tracked. |
| DAST Scanning | 0/1 | 🔴 Failed | The app is a web service, but no OWASP ZAP, Nuclei, StackHawk, Burp, or endpoint-hitting DAST CI was found. |
| PII Handling | 0/1 | 🔴 Failed | The app has user/JWT concepts, but no PII classification, masking utilities, data-handling docs, or PII scanner was found. |
| Privacy Compliance | 0/1 | 🔴 Failed | No consent management, data retention policy, export/deletion handling, anonymization, or privacy compliance docs found. |
| Sensitive Data Log Scrubbing | 0/1 | 🔴 Failed | No configured log redaction, sanitizer, masking utility, or log-scrubbing documentation found. |
| Minimum Dependency Release Age | 0/1 | 🔴 Failed | No Renovate minimumReleaseAge/stabilityDays, dependency delay policy, or custom release-age gate found. |
| Secret Scanning | 1/1 | 🟢 Passed | Admin gh API access confirmed and GitHub secret-scanning alerts endpoint returned successfully with an empty alert array. |
| Secrets Management | 1/1 | 🟢 Passed | Production deploy uses GitHub environment secrets and scripts/setup-prod-github.ts manages gh environment secrets/variables. |

## Task Discovery

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Issue Templates | 0/1 | 🔴 Failed | No .github/ISSUE_TEMPLATE or GitLab issue templates found. |
| Issue Labeling System | 0/1 | 🔴 Failed | Repository labels are the GitHub defaults and lack priority and area taxonomy. |
| PR Templates | 0/1 | 🔴 Failed | No .github/pull_request_template.md or merge request template found. |
| Backlog Health | 1/1 | 🟢 Passed | gh issue list returned no open issues, so there is no stale or unlabeled open backlog to remediate. |

## Product & Experimentation

| Criterion | Score | Status | Rationale |
|-----------|-------|--------|-----------|
| Product Analytics Instrumentation | 0/1 | 🔴 Failed | No Mixpanel, Amplitude, PostHog, Heap, GA4, or equivalent product analytics instrumentation found. |
| Error to Insight Pipeline | 0/1 | 🔴 Failed | No Sentry-GitHub/GitLab integration, error-to-issue workflow, or incident-to-issue automation found. |

---

*Generated by Factory Agent Readiness*
