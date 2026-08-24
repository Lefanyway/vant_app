#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_DIR="$ROOT/.replit-vlr-upstream"
UPSTREAM_URL="https://github.com/grgaoun/vlr.git"
UPSTREAM_COMMIT="e27cec7370b527cfa27589898628378b0f6499b5"

if [ -e "$UPSTREAM_DIR" ] && [ ! -d "$UPSTREAM_DIR/.git" ]; then
  rm -rf "$UPSTREAM_DIR"
fi

if [ ! -d "$UPSTREAM_DIR/.git" ]; then
  git clone "$UPSTREAM_URL" "$UPSTREAM_DIR"
fi

git -C "$UPSTREAM_DIR" fetch --quiet origin "$UPSTREAM_COMMIT"
git -C "$UPSTREAM_DIR" checkout --quiet --detach "$UPSTREAM_COMMIT"

REQUIREMENTS_HASH="$(sha256sum "$UPSTREAM_DIR/requirements.txt" | awk '{print $1}')"
REQUIREMENTS_MARKER="$UPSTREAM_DIR/.vant-requirements.sha256"

if ! python -c "import fastapi, httpx, lxml, selectolax, slowapi, uvicorn" >/dev/null 2>&1 || \
  [ ! -f "$REQUIREMENTS_MARKER" ] || \
  [ "$(cat "$REQUIREMENTS_MARKER")" != "$REQUIREMENTS_HASH" ]; then
  pip install --user --break-system-packages -r "$UPSTREAM_DIR/requirements.txt"
  printf '%s\n' "$REQUIREMENTS_HASH" > "$REQUIREMENTS_MARKER"
fi

export PYTHONPATH="$ROOT/services/vlr-api:$UPSTREAM_DIR${PYTHONPATH:+:$PYTHONPATH}"
exec uvicorn vant_entrypoint:app --host 127.0.0.1 --port 3001