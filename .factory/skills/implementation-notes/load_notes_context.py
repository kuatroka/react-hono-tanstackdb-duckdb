#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
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
    config = automation.default_config()
    context = automation.build_session_start_context(
        automation.load_notes_text(),
        max_entries=int(config["session_start_max_entries"]),
    )
    if context:
        print(context)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
