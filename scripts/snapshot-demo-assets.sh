#!/usr/bin/env bash
set -euo pipefail

# Snapshots the docs + fixtures that get baked into the Cloud Run image.
#
# The deployed agent runs in mock mode (no Claude credentials), so the
# fixture matcher is what answers visitor chips. Both docs and fixtures
# come from the product the demo is wired against - currently Pulsefile.
#
# Source resolution (first match wins):
#   1. First positional arg
#   2. PRODUCT_REPO_PATH from the env (or sourced from .env at repo root)
#
# Usage:  ./scripts/snapshot-demo-assets.sh [PRODUCT_REPO_PATH]

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Source .env so PRODUCT_REPO_PATH (and any other relevant vars) become
# available even when the script is run outside of dev.sh.
if [ -f "$REPO_ROOT/.env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +o allexport
fi

SOURCE="${1:-${PRODUCT_REPO_PATH:-}}"
if [ -z "$SOURCE" ]; then
  echo "error: no source path. Pass it as an arg or set PRODUCT_REPO_PATH in .env" >&2
  exit 1
fi

TARGET_DIR="$REPO_ROOT/apps/api/demo-assets"
DOCS_TARGET="$TARGET_DIR/docs"
FIXTURES_TARGET="$TARGET_DIR/fixtures"

if [ ! -d "$SOURCE/docs" ] || [ ! -d "$SOURCE/fixtures/mock-responses" ]; then
  echo "error: $SOURCE is not a Pulsefile checkout (missing docs/ or fixtures/mock-responses/)" >&2
  exit 1
fi

rm -rf "$DOCS_TARGET" "$FIXTURES_TARGET"
mkdir -p "$DOCS_TARGET" "$FIXTURES_TARGET"

cp -R "$SOURCE/docs/." "$DOCS_TARGET/"
cp -R "$SOURCE/fixtures/mock-responses/." "$FIXTURES_TARGET/"

DOCS_COUNT=$(find "$DOCS_TARGET" -name "*.md" | wc -l | tr -d ' ')
FIXTURES_COUNT=$(find "$FIXTURES_TARGET" -name "*.json" | wc -l | tr -d ' ')

cat > "$TARGET_DIR/SNAPSHOT.md" <<EOF
# Demo assets snapshot

Snapshotted from \`$SOURCE\` on $(date -u '+%Y-%m-%d %H:%M UTC').

- $DOCS_COUNT markdown docs in \`docs/\`
- $FIXTURES_COUNT fixture JSONs in \`fixtures/\`

Re-snapshot with \`./scripts/snapshot-demo-assets.sh\`.
EOF

echo "snapshot complete: $DOCS_COUNT docs + $FIXTURES_COUNT fixtures into $TARGET_DIR"
