# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hindsight** is a personal reflective system with three components sharing one cognitive layer:
1. **Note Worker** — real-time per-note AI processing (BullMQ + SSE)
2. **Report Worker** — weekly batch narrative generation (BullMQ + Python pipeline + LLM)
3. **MCP Server** — on-demand context retrieval for Claude conversations

The cognitive layer is two databases: MongoDB (notes + metadata) and Supabase Postgres + pgvector (embeddings + cognitive units).

## Commands

### Frontend (root directory)
```bash
npm run dev        # Vite dev server on port 3005 (proxies /api → localhost:3001)
npm run build      # tsc -b && vite build
npm run lint       # eslint
npm test           # vitest
```

### Backend (`backend/` directory)
```bash
npm run dev        # tsx watch server.js (development with hot reload)
npm start          # cross-env NODE_ENV=production tsx server.js
npm run typecheck  # tsc (type-check only, no emit)
```

Backend runs on port 3001. Weekly cron jobs only start in `NODE_ENV=production`.

## Architecture

### Note Processing Pipeline
1. Frontend POSTs note → `noteController.createNote` enqueues job to BullMQ `ai-processing` queue
2. `aiWorker.js` processes job: locks note in MongoDB (idempotency), vector-searches related notes, calls OpenAI Responses API with streaming
3. Stream is split on `<METADATA>` marker: content before is SSE-streamed to frontend, JSON after is parsed for title/keywords/summary/analysis/cognitiveUnits
4. Frontend subscribes via `GET /notes/:id/stream` SSE; `useNoteStream` hook renders typewriter effect at 5 chars/30ms
5. Post-processing (fire-and-forget): save note embedding to Supabase, merge cognitive units via semantic similarity (0.92 threshold)

### Report Generation Pipeline
1. `node-cron` triggers weekly (Sunday 00:00 JST) → enqueues to BullMQ `report-generation` queue
2. `reportWorker.js`: locks Report doc, fetches notes from MongoDB, fetches previous period's report from Postgres (for trend data), spawns Python pipeline via stdin/stdout JSON
3. Python pipeline returns `report_json` with aggregated stats and a `snapshot` string
4. LLM call with snapshot → `summary` + `poeticLine`; result saved to MongoDB Report doc

### MCP Server (`backend/mcp/server.js`)
Stateless StreamableHTTP — builds a fresh server + transport per request. Four tools: `search_personal_knowledge`, `get_user_profile`, `get_recent_context`, `get_full_context`. Authentication uses long-lived bearer tokens (`backend/lib/mcpToken.js`). Tool descriptions function as prompt engineering — they tell Claude how to interpret `sourceType` and `description` fields.

### Data Models
- **MongoDB** (`backend/models/`): `Note`, `Report`, `User`
- **Postgres** (Supabase): `note_embeddings` (1536-dim vectors, linked to MongoDB via `note_id`), `cognitive_units` (concept + context, merged by embedding similarity), `period_reports` (weekly pipeline output for trend data). Schema in `backend/SQL/Migration.sql`.

### Key Design Decisions

**sourceType trust hierarchy**: Notes have `sourceType: "authored" | "saved"`. This field propagates through the entire stack — buildPrompt, MCP tool descriptions, report worker — to prevent LLM from treating saved external content as the user's own thoughts. The `description` field (user's reason for saving) is the highest-trust signal, above sourceType, above content inference.

**Lock-based idempotency**: Before processing, `lockNote()` atomically sets `status: "processing"` and `generationId` (the BullMQ job ID). `saveAIResult()` only writes if both match — prevents duplicate writes if BullMQ delivers a job twice.

**Rollback on failure**: On job creation, `rawContent`/`title` are backed up to `previousContent`/`previousTitle` (hidden fields, `select: false`). If all BullMQ retries fail, `rollbackNote()` restores them.

**Cognitive unit merging**: Each new unit is embedded (concept + context), then searched against existing units at 0.92 cosine similarity. Matches merge (context appended up to 1000 chars, confidence converges with `new = old + (1 − old) × 0.3`). Units run sequentially, not parallel, to prevent two similar new units both inserting instead of merging.

## Frontend Structure

- **State**: Redux for auth (`authSlice`), TanStack Query for notes/reports with infinite scroll
- **Styling**: SCSS modules per component; design tokens in `src/styles/_token.scss`
- **Routes**: `/` (LandingPage), `/login`, `/register`, `/home` (MainContent), `/review` (ReportPage), `/note/:id` (NotePage) — all protected except landing/auth
- **Auth flow**: On mount, `AppContent` attempts token refresh via `/auth/refresh`. `ProtectedRoute` handles redirect; landing/login/register stay accessible without auth.
- **SSE**: `useNoteStream` hook opens `EventSource` to `/notes/:id/stream`. The server buffers chunks 5-chars at a time per 30ms interval for the typewriter effect.

## Environment

Backend env vars (`.env.development` / `.env.production`): `MONGODB_URI`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `CLIENT_ORIGIN`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE`, `COOKIE_SAMESITE`.

Frontend: `VITE_API_BASE_URL` (set to backend URL in production; dev uses Vite proxy so can be omitted).

## Deployment

- Frontend: Vercel (`vercel.json` at root)
- Backend: Fly.io (`backend/fly.toml`, `backend/Dockerfile`)

## Python Environment
- This project uses a Python virtual environment located at `analytics/.venv`.
- Both `python` and `python3` are auto-detected and point to this virtual environment, so no manual activation is normally required.
- If for any reason the virtual environment is not picked up automatically, activate it first with `source analytics/.venv/bin/activate`, or run scripts directly via `analytics/.venv/bin/python`.

## Workflow Rules (follow these for every code change)

Before writing or modifying any code, always follow this process:

1. **Confirm requirements first.** Before touching any code, restate your understanding of what I want and confirm it with me. Do not start writing code until I have confirmed.

2. **Ask for file locations instead of searching.** Before making changes, proactively ask me which files/modules need to be modified and their paths. I will provide them. Do not search the codebase on your own unless I explicitly ask you to — I will tell you where to look. This saves time and lets me review whether the targeted files are the right ones.

3. **Pause and ask when unclear.** While working, if anything is ambiguous, or if you encounter a conflict, an unexpected situation, or a decision point I haven't specified, stop and ask me for clarification rather than guessing or proceeding on assumptions.

4. **Proceed only after alignment.** Only begin writing code once requirements are confirmed and the target files are agreed upon.

5. **Write all code comments in English.** All comments in the code must be written in English, regardless of the language we are communicating in during our conversation. Commit messages should also be in English.