#!/bin/bash
set -e
pnpm install --frozen-lockfile
if [ -n "${DATABASE_URL:-}" ]; then
  pnpm --filter @workspace/db run push
else
  echo "DATABASE_URL not configured; keeping the in-memory fallback."
fi
