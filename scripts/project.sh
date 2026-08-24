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

export PORT="${PORT:-5000}"
exec pnpm --filter @workspace/api-server run dev