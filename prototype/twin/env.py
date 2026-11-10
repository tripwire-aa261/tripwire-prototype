"""Read API keys from local .env files without printing them.

Looked up in this order (first hit wins):
  1. the process environment
  2. prototype/.env
  3. aa261/.env.local   (the folder above prototype/)
  4. aa261/.env

Files are plain KEY=VALUE lines; '#' starts a comment. Never commit these files.
"""
from __future__ import annotations

import os
from pathlib import Path

PROTOTYPE_DIR = Path(__file__).resolve().parent.parent
CANDIDATES = [
    PROTOTYPE_DIR / ".env",
    PROTOTYPE_DIR.parent / ".env.local",
    PROTOTYPE_DIR.parent / ".env",
]


def _parse(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return out
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        out[key] = value
    return out


def get_key(name: str) -> str | None:
    """Return the value of `name`, or None. The value is never logged."""
    if os.environ.get(name):
        return os.environ[name]
    for path in CANDIDATES:
        value = _parse(path).get(name)
        if value:
            return value
    return None


def key_source(name: str) -> str | None:
    """Where a key was found (for messages), without revealing it."""
    if os.environ.get(name):
        return "environment"
    for path in CANDIDATES:
        if _parse(path).get(name):
            return str(path.relative_to(PROTOTYPE_DIR.parent))
    return None
