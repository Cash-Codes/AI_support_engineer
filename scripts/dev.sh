#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Tight palette so logs stay readable.
B="\033[1m"; D="\033[2m"; R="\033[0m"
GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"

# ---------------------------------------------------------------- pre-flight
printf "${B}[dev]${R} pre-flight\n"

if [ -f .env ]; then
  printf "  ${GREEN}✓${R} .env present\n"
  set -o allexport; source .env; set +o allexport
else
  printf "  ${YELLOW}!${R} .env not found - using defaults; copy .env.example to enable live integrations\n"
fi

if [ -n "${PRODUCT_REPO_PATH:-}" ]; then
  if [ -d "$PRODUCT_REPO_PATH" ]; then
    printf "  ${GREEN}✓${R} PRODUCT_REPO_PATH=${D}${PRODUCT_REPO_PATH}${R}\n"
  else
    printf "  ${YELLOW}!${R} PRODUCT_REPO_PATH set but directory missing: ${D}${PRODUCT_REPO_PATH}${R}\n"
  fi
else
  printf "  ${YELLOW}!${R} PRODUCT_REPO_PATH not set - RAG falls back to local docs/, code investigation disabled\n"
fi

if command -v gh >/dev/null 2>&1; then
  printf "  ${GREEN}✓${R} gh CLI available (live PR flow possible)\n"
else
  printf "  ${YELLOW}!${R} gh CLI not installed - live PR flow disabled\n"
fi

# ----------------------------------------------------------------- build
printf "\n${B}[dev]${R} building shared + widget…\n"
pnpm --filter @ai-support/shared build > /dev/null
printf "  ${GREEN}✓${R} @ai-support/shared\n"
pnpm --filter @ai-support/widget build > /dev/null
printf "  ${GREEN}✓${R} @ai-support/widget\n"

# ----------------------------------------------------------------- banner
printf "\n${B}[dev]${R} services starting…\n"
printf "  ${CYAN}api      →${R}  http://localhost:8080\n"
printf "  ${CYAN}dashboard→${R}  http://localhost:5174\n"
printf "  ${CYAN}demo     →${R}  http://localhost:8080/demo/\n"
printf "  ${CYAN}widget   →${R}  http://localhost:8080/widget/   ${D}(iframe content)${R}\n"
printf "\n${D}press ctrl-c to stop both services${R}\n\n"

# ----------------------------------------------------------------- run
exec pnpm exec concurrently \
  --kill-others-on-fail \
  -n api,dashboard \
  -c cyan,magenta \
  "pnpm --filter @ai-support/api dev" \
  "pnpm --filter @ai-support/dashboard dev"
