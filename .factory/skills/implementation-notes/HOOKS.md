# Implementation Notes Hook Layout

## Purpose
Keep all implementation-notes automation in this skill directory so the behavior, hook entrypoints, and local state stay together.

## Files
- `SKILL.md` — skill instructions and pointers to the automation files.
- `automation.py` — shared parsing, candidate collection, dedupe, and note rendering logic.
- `load_notes_context.py` — `SessionStart` hook entrypoint; injects a short curated summary into context.
- `record_prompt.py` — `UserPromptSubmit` hook entrypoint; stores durable user-directive candidates for the active session.
- `capture_note_candidate.py` — `PostToolUse` hook entrypoint; records high-signal tool outcomes.
- `curate_notes.py` — `Stop` and `SessionEnd` hook entrypoint; promotes durable candidates into `IMPLEMENTATION_NOTES.md`.
- `.state/` — local session state for the automation pipeline. Kept out of git.

## Hook wiring
Project hooks in `.factory/settings.json` should call these scripts via:
- `python3 "$FACTORY_PROJECT_DIR"/.factory/skills/implementation-notes/<script>.py`

## Current scope
The deterministic curator currently promotes:
- repeated or explicit self-contained implementation-notes directives
- high-signal SSH public-key failures that should become reusable runtime guidance

Add more detectors in `automation.py` only when they are durable and low-noise.
