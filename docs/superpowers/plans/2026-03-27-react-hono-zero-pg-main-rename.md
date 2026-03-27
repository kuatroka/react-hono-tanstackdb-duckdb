# React Hono Zero PG Main Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the repository checkout and GitHub remote to `react-hono-zero-pg-main`, and update the homepage title to `fintellectus (zero)` without changing runtime identifiers.

**Architecture:** Treat this as a repo-identity cleanup, not an application rewrite. Only the filesystem checkout path, git remote URL, and the browser title should change; the package name, Zero publication, SST app name, and other internal identifiers stay untouched to keep the current working runtime stable.

**Tech Stack:** Git, GitHub CLI, Bun, Vite, HTML.

---

## File Structure / Responsibilities

### Repository identity
- Modify: git remote `origin` (rename GitHub repo and update local remote URL)
- Modify: local checkout path from `/Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration` to `/Users/yo_macbook/Documents/dev/react-hono-zero-pg-main`

### UI title
- Modify: `index.html` — update the `<title>` to `fintellectus (zero)`

### Verification
- Read: `package.json`, `index.html`, `git remote -v`
- Test: `bun run dev` and a browser smoke check of the homepage title

---

## Task 1: Rename the GitHub repo and local checkout

**Files:**
- Modify: git remote `origin`
- Modify: checkout path on disk

- [ ] **Step 1: Rename the GitHub repository**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
gh repo rename react-hono-zero-pg-main --yes
```
Expected: GitHub accepts the rename and keeps the same repository contents.

- [ ] **Step 2: Update the local remote URL**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/zero-hono-before-tanstack-migration
git remote set-url origin https://github.com/kuatroka/react-hono-zero-pg-main.git
git remote -v
```
Expected: `origin` points at the renamed repo.

- [ ] **Step 3: Rename the local checkout directory**

Run:
```bash
cd /Users/yo_macbook/Documents/dev
mv zero-hono-before-tanstack-migration react-hono-zero-pg-main
```
Expected: the repository now lives at `/Users/yo_macbook/Documents/dev/react-hono-zero-pg-main`.

---

## Task 2: Update the homepage title

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Change the browser title**

Replace:
```html
<title>Fintellectus (Zero)</title>
```
With:
```html
<title>fintellectus (zero)</title>
```

- [ ] **Step 2: Keep all other identifiers unchanged**

Do not change `package.json`, `sst.config.ts`, Zero publication names, or the app runtime script names.

---

## Task 3: Verify the rename end-to-end

**Files:**
- Read: `git status`, `git remote -v`, `index.html`

- [ ] **Step 1: Confirm the repo path and remote**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/react-hono-zero-pg-main
git status --short --branch
git remote -v
```
Expected: clean checkout on `main`, with `origin` pointing to the renamed GitHub repo.

- [ ] **Step 2: Start the app and verify the title in a browser**

Run:
```bash
cd /Users/yo_macbook/Documents/dev/react-hono-zero-pg-main
bun run dev
```
Then open `http://localhost:3001` and verify the tab/page title is `fintellectus (zero)`.

- [ ] **Step 3: Commit the rename**

```bash
git add index.html
git commit -m "chore: rename the repo and homepage title"
```
