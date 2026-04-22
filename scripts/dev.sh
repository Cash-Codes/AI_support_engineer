#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[dev] Building shared types + widget (one-time)..."
pnpm --filter @ai-support/shared build
pnpm --filter @ai-support/widget build

echo "[dev] Starting api + dashboard..."
pnpm exec concurrently \
  -n api,dashboard \
  -c cyan,magenta \
  "pnpm --filter @ai-support/api dev" \
  "pnpm --filter @ai-support/dashboard dev"
