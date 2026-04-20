#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType


def _load_automation() -> ModuleType:
    module_path = Path(__file__).resolve().with_name("automation.py")
    spec = importlib.util.spec_from_file_location("implementation_notes_automation", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    automation = _load_automation()
    payload = json.load(sys.stdin)
    session_id = str(payload.get("session_id") or "unknown-session")
    prompt = str(payload.get("prompt") or "")
    state = automation.load_session_state(session_id)
    automation.record_prompt(
        state,
        prompt,
        automation.utc_now_iso(),
        automation.default_config(),
    )
    automation.save_session_state(state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
