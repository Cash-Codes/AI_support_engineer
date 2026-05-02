# AI Support Engineer - Cloud Run image (mock-mode demo).
#
# Two stages: build everything in the workspace, then copy only what the
# api needs into a slim runtime. The widget's loader + iframe SPA are
# emitted to repo-root /dist/widget/ at build time and served as static
# assets by the api.

# ────────────────────────────────────────────────────────────────────
# Stage 1 - builder
# ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# better-sqlite3 + onnxruntime + transformers compile native bindings.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm via corepack and pin to the workspace's declared version.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/widget/package.json apps/widget/

RUN pnpm install --frozen-lockfile

# Source - kept after install so dep changes don't bust the source layer.
COPY tsconfig.base.json biome.json ./
COPY packages packages
COPY apps apps

# Build order: shared → api (consumes shared) → widget (loader + app SPA)
# → dashboard (the bundled session-replay UI served at /dashboard/).
RUN pnpm --filter @ai-support/shared build \
 && pnpm --filter @ai-support/api build \
 && pnpm --filter @ai-support/widget build \
 && pnpm --filter @ai-support/dashboard build

# ────────────────────────────────────────────────────────────────────
# Stage 2 - runtime
# ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

# Copy the workspace metadata so node module resolution works against
# pnpm's symlinked node_modules tree.
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules

# Built workspace packages. The per-workspace node_modules dirs are
# pnpm symlink farms pointing into /app/node_modules/.pnpm - they're
# tiny but required for module resolution at runtime.
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules

# Built api.
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules

# Demo assets (docs + fixtures snapshot from the product repo).
COPY --from=builder /app/apps/api/demo-assets apps/api/demo-assets

# Built widget assets (loader.js + iframe SPA), served by the api at
# /widget/loader.js and /widget/* respectively.
COPY --from=builder /app/dist/widget dist/widget

# Built dashboard SPA, served by the api at /dashboard/*.
COPY --from=builder /app/dist/dashboard dist/dashboard

EXPOSE 8080

# Default DOCS_DIR + FIXTURES_DIR point at the bundled snapshot. Override
# in deploys that ship against a different product. WIDGET_ALLOWED_ORIGINS
# is set per-deployment via Cloud Run env vars (not baked).
ENV DOCS_DIR=/app/apps/api/demo-assets/docs \
    FIXTURES_DIR=/app/apps/api/demo-assets/fixtures \
    DATABASE_PATH=:memory: \
    DEMO_MODE=true

CMD ["node", "apps/api/dist/server.js"]
