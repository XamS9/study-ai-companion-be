# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Backend half of a two-repo project. The React Native + Expo client lives in the sibling `studyai-companion-fe`. `src/jobs/` and `src/utils/` are empty — cron cleanup jobs and shared utilities are yet to be added. All feature modules (subjects, materials, exams, ai, dashboard, profile) are implemented and wired up. The `profile` module (`GET`/`PATCH /api/profile`) returns a deliberately snake_case DTO to mirror `public.profiles` and the client's direct-Supabase reads.

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
| `pnpm db:push` | Push local migrations to the linked Supabase project |
| `pnpm db:migrations` | List migration history |

No test runner is configured. Docker: `docker compose up --build` (prod-style) or `docker compose --profile dev up` (hot reload); both read `.env`.

## Architecture

**ESM + TypeScript, Express 5.** `package.json` sets `"type": "module"` with `tsconfig` `module`/`moduleResolution` = `NodeNext`. **Relative imports must use `.js` extensions** in `.ts` source (e.g. `import { env } from './config/env.js'`). Express 5 forwards rejected async promises to the error handler automatically — never use `express-async-errors`.

**Request lifecycle.**
1. `src/index.ts` calls `createApp()` and `listen()`.
2. `src/app.ts` wires base middleware and mounts `apiRouter` at `/api`.
3. `src/routes/index.ts` applies `requireAuth` to every `/api` route, then delegates to feature routers.
4. Feature modules follow a three-file split: `*.routes.ts` → `*.controller.ts` → `*.service.ts` + `*.schema.ts`.

**Auth.** `requireAuth` (`src/middleware/auth.ts`) validates the `Authorization: Bearer <jwt>` header via Supabase Auth and attaches `req.user`, `req.userId`, and `req.db` (a per-request, RLS-enforced Supabase client bound to the same token). All three are typed via `src/types/express.d.ts` which augments `Express.Request`.

**Config.** `src/config/env.ts` validates `process.env` with Zod and exports a typed `env` object. Never read `process.env` directly. Supabase/OpenAI vars are `.optional()` so the server boots without credentials; tighten to `.required()` as integrations land.

**Error handling.** Services throw `AppError(status, message)` for operational errors (defined in `src/middleware/error.ts`). Zod parse failures propagate as `ZodError` — the central `errorHandler` catches both and formats JSON responses. Controllers can simply `throw` without try/catch.

**Supabase clients (two, by design).** `src/lib/supabase.ts` exports both:
- `createUserClient(token)` — **the default**. A per-request client carrying the caller's access token, so Postgres **RLS (`auth.uid()`) enforces row ownership**. `requireAuth` attaches it as `req.db`; feature services accept it as their first argument (`db: SupabaseClient`). Services still also filter by `user_id` as belt-and-suspenders, but RLS is now the real guard.
- `getSupabaseAdmin()` — a lazily initialised service-role client that **bypasses RLS**. Reserved for privileged, non-user-scoped work: JWT verification in `requireAuth`, future cron jobs in `src/jobs/`, and cross-user/admin/webhook tasks. Both clients fail loudly if their env vars are missing (`createUserClient` needs `SUPABASE_ANON_KEY`).

**Carve-out:** the `profile` module deliberately stays on `getSupabaseAdmin()` — `public.profiles` is auth-managed and its RLS policies aren't in this repo's migrations, so writes go through the trusted backend (still scoped by `id = userId`). Rule of thumb: reach for `req.db`; escalate to the admin client only with a specific, reviewable reason.

**AI module.** `src/modules/ai/ai.service.ts` has four operations: `summarize`, `generateQuestions`, `generateFlashcards`, and `processMaterial` (one-shot: summary + key concepts + flashcards + question bank from a single OpenAI call). All require `OPENAI_API_KEY` and return `503` if missing. Responses are validated against Zod schemas before being persisted.

## Database schema

Migrations live in `supabase/migrations/` and are applied via `pnpm db:push`. Tables: `subjects`, `materials`, `questions`, `exam_questions`, `exams`, `flashcards`. The `materials` table has `content` (raw text), `summary` (AI-generated), and `key_concepts` (jsonb array). `exam_questions` is a snapshot table — it stores a copy of each question as it appeared at exam time. RLS is enabled on all tables with owner policies (`auth.uid() = user_id`); the API now executes feature queries through the per-request user client (`req.db`), so those policies actively enforce ownership. Only the `profile` module and privileged paths use the service-role key, which bypasses RLS.

## External services

- **Supabase** via `@supabase/supabase-js` (service-role key). `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- **OpenAI** for AI generation (`OPENAI_MODEL`, default `gpt-4o-mini`). Only paid dependency.
- Deployment target: Render / Railway free tier (the `Dockerfile` works directly there).
- **⚠️ Run a single instance.** The AI regeneration throttle (`src/middleware/rate-limit.ts`,
  used by `POST /api/subjects/:id/regenerate-questions`) keeps state in-process, so multiple
  replicas would each throttle independently and multiply the effective limit. Keep the deploy
  at one instance until the limiter is moved to a shared store (Postgres preferred — already
  available via Supabase; Redis only if many high-frequency limiters appear). The
  `rateLimit(windowMs, keyFn)` interface is store-agnostic, so swapping is localized.
