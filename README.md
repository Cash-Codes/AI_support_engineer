# AI Support Engineer

Agentic support system. User sends a bug report → docs RAG → optional code investigation → explanation + workaround → Shortcut ticket → optional fix PR.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend on `http://localhost:5173`, backend on `http://localhost:8080`.

## Packages

- `packages/shared` - types shared between frontend and backend
- `packages/frontend` - React + Vite + Tailwind chat UI
- `packages/backend` - Node + Express orchestrator

## Scripts

- `npm run dev` - starts frontend + backend concurrently
- `npm run build` - builds all packages
- `npm run test` - runs test suites
- `npm run lint` - Biome lint check
- `npm run typecheck` - TypeScript `--noEmit` on all packages

## Architecture

Two deployables: this support engineer (chat UI + orchestrator), and the separate `ai_support_agents_product` Svelte app it supports.
