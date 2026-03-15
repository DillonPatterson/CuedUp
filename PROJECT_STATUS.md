# PROJECT_STATUS

## 1. Current Stage

CuedUp is in fixture-driven replay validation.

The canonical repo is:

`C:\Users\dillo\Desktop\CuedUp`

That Desktop repo is the only working source of truth now.

## 2. What Is Already Built

- Next.js + TypeScript app scaffold
- Supabase foundation
- dossier schema and mock prep pipeline
- sparse live mode
- separate replay/debug route
- deterministic conversation-state engine
- unresolved thread tracking
- Presence Guard
- replay timeline builder
- manual replay transcript input
- replay-only JSON transcript loading
- three replay transcript fixtures

## 3. What Was Just Fixed

- replay fixture loading/reset now exists directly in replay/debug
- fixture loading no longer requires copy-paste
- fixture-load positioning bug was fixed
- loading a fixture now lands on the snapshot produced by the last loaded turn
- reset-to-seeded mock session still intentionally returns replay to the start
- local path confusion was cleaned up and Desktop CuedUp is confirmed canonical

## 4. Current Mission

Stop guessing and prove the engine behavior against the known replay fixtures.

The job right now is not product expansion. The job is validation.

## 5. What Must Be Proven Now

Run the replay fixtures and verify:

- unresolved threads open when they should
- unresolved threads stay open when they should
- unresolved threads cool or resolve when they should
- Presence Guard surfaces a cue only when it should
- Presence Guard suppresses output when it should
- saturation/repetition behavior stays sparse instead of turning noisy
- replay fixture switching and reset behavior stay deterministic

## 6. What Is Not Ready Yet

- live transcript ingestion
- mic input
- streaming transcription
- earbud / earpiece workflow
- production AI wording
- production persistence workflow
- anything that depends on live operator trust

## 7. When Mic Testing Becomes Appropriate

Mic testing becomes appropriate only after replay validation is boringly consistent.

That means the current fixtures should be run repeatedly and the engine behavior should be understandable, stable, and low-noise before any live transcript path is introduced.

## 8. Next Real Move

Open replay/debug, run the three fixtures, and verify actual engine behavior:

- `thread-revisit-later`
- `evasive-run-pressure`
- `saturation-plateau-repeat`

If replay does not behave cleanly there, live work should not start.

## 9. What Not To Touch Yet

- live mode behavior
- mic / streaming work
- earbud / earpiece ideas
- new model integrations
- product polish passes
- dashboard expansion
- persistence work beyond what already exists
- broad refactors

Keep the focus on replay validation until the engine earns the next step.
