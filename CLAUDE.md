# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This repo is **startup boilerplate**, not a feature-complete app. It currently contains
dependencies, folder structure, config, and a minimal runnable Express server exposing
`/health`. The feature modules under `src/modules/` are empty (`.gitkeep`) — endpoints,
business logic, Supabase/OpenAI clients, and cron jobs are still to be implemented. It is
the backend half of a two-repo project; the React Native + Expo client lives in the sibling
`studyai-companion-fe`.

## Commands

Use Node 22 (`nvm use` — pinned in `.nvmrc`) and pnpm.

| Command | Purpose |
|---|---|
| `pnpm dev` | Run with `tsx watch` (hot reload) at http://localhost:4000 |
| `pnpm build` | Compile TypeScript → `dist/` |
| `pnpm start` | Run compiled output (`node dist/index.js`) |
| `pnpm lint` | ESLint (flat config, typescript-eslint) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Prettier write |

There is no test runner configured yet. Docker: `docker compose up --build` (prod-style)
or `docker compose --profile dev up` (hot reload); both read `.env`.

## Architecture

- **ESM + TypeScript, Express 5.** `package.json` sets `"type": "module"` with `tsconfig`
  `module`/`moduleResolution` = `NodeNext`. **Relative imports must use `.js` extensions**
  in `.ts` source (e.g. `import { env } from './config/env.js'`) — this is required for the
  compiled output to resolve under Node ESM. Express 5 handles async route errors natively,
  so no `express-async-errors` wrapper is needed.
- **Composition root.** `src/index.ts` only calls `createApp()` (from `src/app.ts`) and
  `listen()`. `src/app.ts` wires base middleware (helmet, cors, json, morgan) and the
  `/health` route; feature routers from `src/routes` / `src/modules` get registered here.
- **Config.** `src/config/env.ts` validates `process.env` with zod and exports a typed `env`
  object. Supabase/OpenAI vars are intentionally `.optional()` so the skeleton boots without
  credentials — tighten them to required as integrations land. Import config via this module
  rather than reading `process.env` directly.
- **Intended module pattern.** Each folder under `src/modules/` (`subjects`, `materials`,
  `ai`, `exams`, `profile`) is meant to follow a controller + service + zod-schema split.
  `ai/` covers summaries, key concepts, flashcards, and the question bank (OpenAI,
  `gpt-4o-mini`). `src/jobs/` is for `node-cron` cleanup / pending-processing tasks.

## External services

- **Supabase** via `@supabase/supabase-js` using the **service-role key** (Auth admin,
  Storage, Postgres). `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose it to the
  mobile client. The client verifies Supabase-issued JWTs; the backend is expected to
  validate them in `src/middleware/`.
- **OpenAI** for AI generation (`OPENAI_MODEL`, default `gpt-4o-mini`) — the only paid
  dependency. Deployment target is the Render / Railway free tier (the `Dockerfile` works
  directly there).
