# AI Support Engineer

Agentic support system. User sends a bug report → docs RAG → optional code investigation → explanation + workaround → Shortcut ticket → optional fix PR.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Web app on `http://localhost:5173`, API on `http://localhost:8080`.

## Layout

- `apps/web` - React + Vite + Tailwind chat UI
- `apps/api` - Node + Express orchestrator
- `packages/shared` - types shared between web and api

## Scripts

- `pnpm dev` - starts web + api concurrently
- `pnpm build` - builds all workspaces
- `pnpm test` - runs test suites
- `pnpm lint` - Biome lint check
- `pnpm typecheck` - TypeScript `--noEmit` across workspaces

## Architecture

Two deployables: this support engineer (chat UI + orchestrator), and the separate `ai_support_agents_product` Svelte app it supports.
