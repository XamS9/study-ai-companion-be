# Study AI Companion — Backend (Express)

Express 5 + TypeScript API for the Study AI Companion MVP. Talks to Supabase
(`@supabase/supabase-js` with the service-role key for Auth admin, Storage, and Postgres)
and OpenAI (`gpt-4o-mini`) for AI generation. `node-cron` handles cleanup / pending
processing tasks. Targets the Render / Railway free tier.

> This repository currently contains the **startup boilerplate only** — dependencies,
> folder structure, config, and a minimal runnable server with a `/health` endpoint.
> Feature endpoints and business logic are implemented in a later session.

## Setup

```bash
nvm use                # Node 22 (pinned in .nvmrc; run `nvm install` once if missing)
pnpm install
cp .env.example .env   # fill in Supabase + OpenAI values (optional for the skeleton)
pnpm dev               # tsx watch — http://localhost:4000
curl http://localhost:4000/health
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Run with `tsx watch` (hot reload) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run compiled output (`node dist/index.js`) |
| `pnpm lint` | ESLint (typescript-eslint) |
| `pnpm format` | Prettier write |
| `pnpm typecheck` | `tsc --noEmit` |

## Docker

Multi-stage build (`Dockerfile`) → lean `node:22-alpine` runtime running as a non-root
user, with a `/health` HEALTHCHECK. Final image ≈ 274 MB.

```bash
# Build + run the production-style image
docker compose up --build            # http://localhost:4000/health
# or without compose:
docker build -t studyai-companion-be .
docker run --env-file .env -p 4000:4000 studyai-companion-be

# Hot-reload dev mode (tsx watch, source bind-mounted)
docker compose --profile dev up
```

`docker compose` reads `.env` (copy it from `.env.example` first). The image is suitable
for Render / Railway, which can build directly from this `Dockerfile`.

## Project structure

```
src/
├── index.ts          # server bootstrap (listen)
├── app.ts            # express app + base middleware + /health
├── config/
│   └── env.ts        # zod-validated environment
├── lib/              # supabase + openai clients (to be added)
├── middleware/       # auth (verify Supabase JWT), error handler, request validation
├── routes/           # route registration
├── modules/          # feature modules — each: controller + service + schema
│   ├── subjects/  materials/  ai/  exams/  profile/
├── jobs/             # node-cron tasks (cleanup / pending processing)
├── types/  utils/
```

Each feature module under `src/modules/` will follow a controller + service + zod-schema
pattern. The `ai/` module covers summaries, key concepts, flashcards, and the question bank.

## Notes

- The project is ESM (`"type": "module"`) — relative imports use `.js` extensions in TS source.
- `SUPABASE_*` and `OPENAI_*` env vars are optional in `config/env.ts` so the skeleton boots
  without credentials; tighten them to required as integrations land.
- The `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose it to the mobile app.
