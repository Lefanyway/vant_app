#!/usr/bin/env bash
set -euo pipefail

if [ ! -d node_modules ] || [ ! -f node_modules/.pnpm/lock.yaml ]; then
  pnpm install --frozen-lockfile
fi

if [ -n "${DATABASE_URL:-}" ]; then
  pnpm --filter @workspace/db run push
else
  echo "DATABASE_URL not configured; keeping the in-memory fallback."
fi

VLR_PID=""
cleanup() {
  if [ -n "$VLR_PID" ] && kill -0 "$VLR_PID" 2>/dev/null; then
    kill "$VLR_PID" 2>/dev/null || true
    wait "$VLR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

bash scripts/vlr-sidecar.sh &
VLR_PID=$!

for attempt in $(seq 1 120); do
  if curl --fail --silent --show-error http://127.0.0.1:3001/v2/health >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$VLR_PID" 2>/dev/null; then
    echo "VLR sidecar exited before becoming healthy." >&2
    exit 1
  fi
  if [ "$attempt" -eq 120 ]; then
    echo "VLR sidecar did not become healthy within 120 seconds." >&2
    exit 1
  fi
  sleep 1
done

export VLR_API_BASE_URL="http://127.0.0.1:3001"
export PORT="${PORT:-5000}"
pnpm --filter @workspace/api-server run dev &
API_PID=$!
wait "$API_PID"