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

healthy=0
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error http://127.0.0.1:3001/v2/health >/dev/null 2>&1; then
    healthy=1
    break
  fi
  if ! kill -0 "$VLR_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ "$healthy" -eq 1 ]; then
  export VLR_API_BASE_URL="http://127.0.0.1:3001"
else
  echo "VLR sidecar unavailable; continuing with PandaScore only." >&2
  if [ -n "$VLR_PID" ] && kill -0 "$VLR_PID" 2>/dev/null; then
    kill "$VLR_PID" 2>/dev/null || true
  fi
  VLR_PID=""
fi

export PORT="${PORT:-5000}"
export NODE_ENV="${NODE_ENV:-development}"
pnpm --filter @workspace/api-server run dev &
API_PID=$!
wait "$API_PID"