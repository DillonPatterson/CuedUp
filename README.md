# CuedUp

CuedUp is a personal-use-first prototype for supporting live interviews with lightweight dossier prep, transcript tracking, background recap generation, and sparse operator nudges.

## Current prototype scope

This repository only sets up the foundation:

- Next.js App Router with TypeScript and Tailwind CSS.
- Zod schemas for the first-pass domain contracts.
- Placeholder pages and components for dossier, live interview, and recap workflows.
- Placeholder API routes with request validation.
- Supabase helpers and SQL migrations for the initial relational model.
- Inngest client wiring and placeholder background functions.

## Project structure

```text
app/                  App Router pages, layouts, global styles, and HTTP routes
components/           Minimal UI shells for live interview and dossier surfaces
inngest/              Background job client and function definitions
lib/deepgram/         Placeholder seam for future transcription streaming work
lib/prompts/          Prompt contracts and response-shape placeholders
lib/schemas/          Zod schemas and input validators for core entities
lib/state/            Conversation-state helpers and next-move planning seam
lib/supabase/         Browser and server Supabase client helpers
supabase/migrations/  Initial SQL migrations for prototype tables
types/                Re-exported TypeScript types inferred from schemas
```

## Major layers

- `app/`: entry points for operators and API consumers.
- `components/`: presentational shells only, with no business logic hidden in the UI.
- `lib/`: domain contracts, integration helpers, and placeholder orchestration seams.
- `supabase/`: database schema evolution and seed data.
- `inngest/`: asynchronous workflows that will later handle dossier and recap generation.

## Dossier contract

A dossier is the structured interview brief for a single guest. It gathers the strongest narrative threads, sensitive pressure points, contradictions, hooks, openings, follow-ups, and source evidence into one object that the rest of the system can reason over.

`StoryVein` is the core object because it represents the main narrative lanes worth exploring live. The other dossier sections mostly support vein selection and timing: live wires show risk, contradictions create pressure, audience hooks shape framing, and source references preserve traceability.

During a live session, the dossier will feed the interview system by helping it choose what to open with, which veins are still uncovered, when a contradiction is worth pressing, and which follow-up fragments are available when a guest gives the operator a usable moment.

## Dossier workflow

The current dossier workflow is intentionally simple and explicit:

1. Source ingestion starts with a development-only source contract covering pasted text, URLs, notes, and transcript excerpts.
2. The prompt contract in `lib/prompts/dossier.ts` turns those sources into a strict long-context extraction brief for a future model.
3. The mock generator in `lib/dossier/mock.ts` produces a deterministic dossier object from sample prep material.
4. Parsing and validation utilities in `lib/dossier/parse.ts` normalize enum-like values, parse raw JSON safely, and reject malformed dossier payloads with useful error output.
5. The dossier page renders the validated dossier into sections built for interviewer prep rather than generic admin display.
6. The dossier handoff layer extracts the live-useful subset for future conversation-state logic.

## Default mock guest

The default working mock guest slug is `test-guest`. It is a development alias over the current mock source set, so these routes should work without any setup:

- `http://localhost:3000/api/dossier?guestId=test-guest`
- `http://localhost:3000/dossier/test-guest`

The original named mock guest slug `mara-vance` still works as well.

## What is not built yet

- Real model calls or provider orchestration.
- Persistent dossier storage in Supabase.
- Human editing workflows for dossier sections.
- Automatic source ingestion, scraping, or document parsing.
- Transcript-driven live reasoning and unresolved-thread state updates.

## Local development

1. Copy `.env.local.example` to `.env.local`.
2. Fill in Supabase, Inngest, and provider keys when those integrations are ready.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Intentionally not built yet

- Authentication and user/session management flows.
- Advanced AI orchestration or provider routing.
- Realtime audio, earbud mode, or speech transport logic.
- Production-grade styling systems, billing, or enterprise-scale abstractions.
- Full Supabase row-level security and production deployment hardening.
