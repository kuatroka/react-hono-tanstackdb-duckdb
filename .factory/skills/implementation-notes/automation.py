from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

CATEGORY_ORDER = [
    "Execution & Validation (Highest Priority)",
    "DuckDB & SQL Guardrails",
    "Process & Runtime Guardrails",
    "Repo-Specific Data Pipeline Guardrails",
    "User Directives",
]

DEFAULT_NOTES = """# Implementation Notes

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + \"Do instead\".

## Execution & Validation (Highest Priority)
1. **[YYYY-MM-DD] Short rule**
   Do instead: concrete repeatable action.

## Domain Behavior Guardrails
1. **[YYYY-MM-DD] Short rule**
   Do instead: concrete repeatable action.

## User Directives
1. **[YYYY-MM-DD] Directive**
   Do instead: exactly follow this preference.
"""

ENTRY_RE = re.compile(r"^\d+\. \*\*\[(\d{4}-\d{2}-\d{2})\] (.+?)\*\*$")
SECTION_RE = re.compile(r"^## (.+)$")
SELF_CONTAINED_DIR_RE = re.compile(r"\.factory/skills/implementation-notes/?")
SELF_CONTAINED_PROMPT_RE = re.compile(
    (
        r"implementation-notes.*(?:same dir|same directory|self-contained|"
        r"implement it all under|reference .*same dir)"
    ),
    re.IGNORECASE | re.DOTALL,
)


def default_config() -> dict[str, Any]:
    return {
        "category_order": CATEGORY_ORDER,
        "session_start_max_entries": 5,
        "category_cap": 10,
    }


def project_root() -> Path:
    factory_project_dir = os.environ.get("FACTORY_PROJECT_DIR")
    if factory_project_dir:
        return Path(factory_project_dir).resolve()
    return Path(__file__).resolve().parents[3]


def skill_dir() -> Path:
    return project_root() / ".factory" / "skills" / "implementation-notes"


def state_dir() -> Path:
    return skill_dir() / ".state"


def notes_path() -> Path:
    return project_root() / "IMPLEMENTATION_NOTES.md"


def session_state_path(session_id: str) -> Path:
    safe_session_id = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id)
    return state_dir() / f"{safe_session_id}.json"


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today_iso() -> str:
    return utc_now_iso().split("T", maxsplit=1)[0]


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def new_session_state(session_id: str) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "created_at": utc_now_iso(),
        "prompts": [],
        "tool_events": [],
        "last_curated_at": None,
    }


def load_session_state(session_id: str) -> dict[str, Any]:
    return load_json_file(session_state_path(session_id), new_session_state(session_id))


def save_session_state(state: dict[str, Any]) -> None:
    save_json_file(session_state_path(str(state["session_id"])), state)


def ensure_notes_document(notes_text: str) -> str:
    cleaned = notes_text.strip()
    if cleaned:
        return cleaned + "\n"
    return DEFAULT_NOTES


def _normalize_title(title: str) -> str:
    normalized = re.sub(r"\s+", " ", title.strip().lower())
    return normalized.rstrip(".")


def _strip_trailing_period(text: str) -> str:
    return text.strip().rstrip(".") + "."


def _parse_notes(notes_text: str) -> dict[str, Any]:
    notes_text = ensure_notes_document(notes_text)
    lines = notes_text.splitlines()
    sections: dict[str, list[str]] = {}
    current_section: str | None = None
    for line in lines[1:]:
        section_match = SECTION_RE.match(line)
        if section_match:
            current_section = section_match.group(1)
            sections[current_section] = []
            continue
        if current_section is not None:
            sections[current_section].append(line)

    parsed_sections: dict[str, Any] = {}
    curation_lines = sections.get("Curation Rules", [])
    parsed_sections["Curation Rules"] = [line for line in curation_lines if line.strip()]

    for section_name, raw_lines in sections.items():
        if section_name == "Curation Rules":
            continue
        entries: list[dict[str, str]] = []
        index = 0
        while index < len(raw_lines):
            entry_match = ENTRY_RE.match(raw_lines[index].strip())
            if not entry_match:
                index += 1
                continue
            date_text, title = entry_match.groups()
            index += 1
            body_lines: list[str] = []
            while index < len(raw_lines) and not ENTRY_RE.match(raw_lines[index].strip()):
                if raw_lines[index].strip():
                    body_lines.append(raw_lines[index].strip())
                index += 1
            do_instead = " ".join(body_lines)
            do_instead = re.sub(r"^Do instead:\s*", "", do_instead)
            entries.append(
                {
                    "date": date_text,
                    "title": _strip_trailing_period(title),
                    "do_instead": do_instead.strip(),
                }
            )
        if entries:
            parsed_sections[section_name] = entries

    return parsed_sections


def _render_notes(parsed_sections: dict[str, Any], category_cap: int) -> str:
    rendered: list[str] = ["# Implementation Notes", ""]
    curation_lines = parsed_sections.get("Curation Rules") or []
    rendered.append("## Curation Rules")
    rendered.extend(curation_lines)
    rendered.append("")

    seen_sections = {"Curation Rules"}
    ordered_sections = list(CATEGORY_ORDER)
    ordered_sections.extend(
        section
        for section in parsed_sections
        if section not in seen_sections and section not in ordered_sections
    )

    for section_name in ordered_sections:
        entries = parsed_sections.get(section_name)
        if not entries:
            continue
        deduped: dict[str, dict[str, str]] = {}
        for entry in entries:
            key = _normalize_title(entry["title"])
            existing = deduped.get(key)
            if existing is None or entry["date"] >= existing["date"]:
                deduped[key] = {
                    "date": entry["date"],
                    "title": _strip_trailing_period(entry["title"]),
                    "do_instead": entry["do_instead"].strip(),
                }
        sorted_entries = sorted(
            deduped.values(),
            key=lambda entry: (entry["date"], entry["title"]),
            reverse=True,
        )[:category_cap]
        rendered.append(f"## {section_name}")
        for index, entry in enumerate(sorted_entries, start=1):
            rendered.append(f"{index}. **[{entry['date']}] {entry['title']}**")
            rendered.append(f"   Do instead: {entry['do_instead']}")
            rendered.append("")
    return "\n".join(rendered).rstrip() + "\n"


def build_session_start_context(notes_text: str, max_entries: int = 5) -> str:
    parsed = _parse_notes(notes_text)
    summary_lines = ["Implementation notes summary:"]
    remaining = max_entries
    for section_name in CATEGORY_ORDER:
        if remaining <= 0:
            break
        for entry in parsed.get(section_name, []):
            summary_lines.append(
                f"- [{section_name}] {entry['title']} Do instead: {entry['do_instead']}"
            )
            remaining -= 1
            if remaining <= 0:
                break
    if len(summary_lines) == 1:
        return ""
    return "\n".join(summary_lines)


def record_prompt(
    state: dict[str, Any],
    prompt: str,
    timestamp: str | None,
    _config: dict[str, Any],
) -> None:
    cleaned = prompt.strip()
    if not cleaned:
        return
    state.setdefault("prompts", []).append(
        {"text": cleaned, "timestamp": timestamp or utc_now_iso()}
    )


def extract_post_tool_event(
    payload: dict[str, Any],
    _config: dict[str, Any],
) -> dict[str, str] | None:
    if payload.get("tool_name") != "Execute":
        return None
    tool_input = payload.get("tool_input") or {}
    tool_response = payload.get("tool_response") or {}
    stderr_text = str(tool_response.get("stderr") or "")
    command_text = str(tool_input.get("command") or "")
    if "Permission denied (publickey)" in stderr_text:
        return {
            "kind": "execute_failure",
            "fingerprint": "execute:ssh-publickey-failure",
            "command": command_text,
            "stderr": stderr_text,
            "timestamp": utc_now_iso(),
        }
    return None


def record_tool_event(
    state: dict[str, Any],
    event: dict[str, str],
    _config: dict[str, Any],
) -> None:
    state.setdefault("tool_events", []).append(event)


def _directive_candidates_from_prompts(
    prompts: list[dict[str, str]],
    today: str,
) -> list[dict[str, str]]:
    matches = 0
    for prompt in prompts:
        prompt_text = prompt.get("text", "")
        if SELF_CONTAINED_DIR_RE.search(prompt_text) and SELF_CONTAINED_PROMPT_RE.search(
            prompt_text
        ):
            matches += 1
    if matches == 0:
        return []
    return [
        {
            "category": "User Directives",
            "title": "Keep implementation-notes automation self-contained.",
            "do_instead": (
                "Store hook scripts, state, and reference files under "
                "`.factory/skills/implementation-notes/` and point project settings there."
            ),
            "date": today,
            "fingerprint": "user-directive:implementation-notes-self-contained",
        }
    ]


def _tool_candidates_from_events(
    tool_events: list[dict[str, str]],
    today: str,
) -> list[dict[str, str]]:
    fingerprints = {event.get("fingerprint") for event in tool_events}
    candidates: list[dict[str, str]] = []
    if "execute:ssh-publickey-failure" in fingerprints:
        candidates.append(
            {
                "category": "Process & Runtime Guardrails",
                "title": "If direct SSH access fails, use an alternative validated execution path.",
                "do_instead": (
                    "Use existing deploy automation or a temporary workflow "
                    "with known-good secrets instead of blocking on "
                    "unavailable local SSH keys."
                ),
                "date": today,
                "fingerprint": "execute:ssh-publickey-failure",
            }
        )
    return candidates


def collect_note_candidates(
    state: dict[str, Any],
    notes_text: str,
    _config: dict[str, Any],
    today: str | None = None,
) -> list[dict[str, str]]:
    notes_text = ensure_notes_document(notes_text)
    current_day = today or today_iso()
    prompts = list(state.get("prompts") or [])
    tool_events = list(state.get("tool_events") or [])
    candidates = _directive_candidates_from_prompts(prompts, current_day)
    candidates.extend(_tool_candidates_from_events(tool_events, current_day))

    deduped: dict[str, dict[str, str]] = {}
    for candidate in candidates:
        deduped[candidate["fingerprint"]] = candidate
    return list(deduped.values())


def apply_candidates_to_notes(
    notes_text: str,
    candidates: list[dict[str, str]],
    category_cap: int = 10,
) -> str:
    parsed_sections = _parse_notes(notes_text)
    for candidate in candidates:
        category = candidate["category"]
        parsed_sections.setdefault(category, [])
        parsed_sections[category].append(
            {
                "date": candidate["date"],
                "title": _strip_trailing_period(candidate["title"]),
                "do_instead": candidate["do_instead"].strip(),
            }
        )
    return _render_notes(parsed_sections, category_cap=category_cap)


def load_notes_text() -> str:
    path = notes_path()
    if not path.exists():
        return ensure_notes_document("")
    return ensure_notes_document(path.read_text(encoding="utf-8"))


def save_notes_text(notes_text: str) -> None:
    notes_path().write_text(ensure_notes_document(notes_text), encoding="utf-8")


def run_curation_for_session(
    session_id: str,
    today: str | None = None,
    config: dict[str, Any] | None = None,
) -> bool:
    active_config = config or default_config()
    state = load_session_state(session_id)
    notes_text = load_notes_text()
    candidates = collect_note_candidates(state, notes_text, active_config, today=today)
    updated_notes = apply_candidates_to_notes(
        notes_text,
        candidates,
        category_cap=int(active_config["category_cap"]),
    )
    state["last_curated_at"] = utc_now_iso()
    save_session_state(state)
    if updated_notes != notes_text:
        save_notes_text(updated_notes)
        return True
    return False
