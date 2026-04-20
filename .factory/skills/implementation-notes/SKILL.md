---
name: implementation-notes
description: Maintains the repo-local IMPLEMENTATION_NOTES.md runbook and its hook-backed automation. Use when working in this repo, capturing durable lessons, curating recurring fixes, or updating the implementation-notes automation under .factory/skills/implementation-notes.
---

# Implementation Notes Runbook

You maintain a per-repo markdown runbook in `@IMPLEMENTATION_NOTES.md`. This is a curated knowledge base for future execution speed and reliability, not a chronological log.

Automation files live alongside this skill:
- Hook overview: [HOOKS.md](HOOKS.md)
- Shared logic: `automation.py`
- Hook entrypoints: `load_notes_context.py`, `record_prompt.py`, `capture_note_candidate.py`, `curate_notes.py`

Keep implementation-notes logic, state, and references inside this directory.

## Session Start: Read And Curate

First thing, every session — read `@IMPLEMENTATION_NOTES.md` before doing anything else. Internalize what's there and apply it silently. Don't announce that you read it. Just apply what you know.

Every time you read it, curate it immediately:

- Re-prioritize items by importance (highest first).
- Merge duplicates and remove stale/low-signal notes.
- Keep only recurring, high-frequency guidance.
- Ensure each item contains an explicit "Do instead" action.
- Enforce category caps (top 10 per category).

If no `@IMPLEMENTATION_NOTES.md` exists yet, create one with the following structure:

```markdown
# Implementation Notes

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[YYYY-MM-DD] Short rule**
   Do instead: concrete repeatable action.

## Domain Behavior Guardrails
1. **[YYYY-MM-DD] Short rule**
   Do instead: concrete repeatable action.

## User Directives
1. **[YYYY-MM-DD] Directive**
   Do instead: exactly follow this preference.
```

Adapt categories to the repo (e.g., DuckDB specific, Regex parsing specific), but keep the category structure and priority ordering. Do not use raw journal-style entries.

## Continuous Runbook Updates

Update during work whenever you learn something reusable.

What qualifies for inclusion:
- Frequent gotchas or surprising behavior in this repo/toolchain (e.g., specific SEC filing edge cases, DuckDB limitations).
- User directives that affect repeated behavior.
- Non-obvious tactics that repeatedly work.

What does not qualify:
- One-off timeline notes.
- Verbose postmortems without reusable action.
- Pure mistake logs without "Do instead" guidance.

Entry format requirements:
- Include date added (`[YYYY-MM-DD]`).
- Include short rule title.
- Include explicit `Do instead:` line.
- Keep wording concise and action-oriented.

## Category And Priority Policy

- Organize notes by category.
- Keep each category sorted by importance descending.
- Re-evaluate category choice and priority whenever editing.
- Maximum 10 items per category; if over 10, remove lowest-priority entries.
- Prefer fewer high-signal items over broad coverage.

## Practical Rule

Think of `@IMPLEMENTATION_NOTES.md` as a live, self-curating knowledge base for future execution speed, not a history file.

## Example Entry

```markdown
1. **[2024-03-15] Pandas corrupts `txt.xz` files**
   Do instead: Only use DuckDB for saving files to a compressed `txt.xz` format as its compression algorithm is correct.
```