# Optional Model-Assisted Curation

## Default mode
The current automation is deterministic by default. It records only known high-signal events and updates `IMPLEMENTATION_NOTES.md` without requiring a model call.

## When to add model assistance
Only add a model-assisted pass when deterministic detectors start missing durable lessons that recur in real use.

## Recommended invocation
If a later iteration needs summarization, prefer a narrow non-interactive call that stays scoped to this skill directory and the notes file, for example:

```bash
DROID_PROJECT_DIR="$FACTORY_PROJECT_DIR" droid exec \
  --auto low \
  --model custom:gpt-5.4-mini(high) \
  --reasoning-effort high \
  --cwd "$FACTORY_PROJECT_DIR" \
  "Read .factory/skills/implementation-notes/HOOKS.md and IMPLEMENTATION_NOTES.md, then dedupe and rewrite only repeated durable implementation lessons."
```

## Guardrails
- Do not run a model on every prompt.
- Use deterministic prefilters first.
- Never let a model turn the notes file into a chronological diary.
- Keep hook scripts usable when the model is unavailable.
