# PROJECT_STATUS

## 1. Current Stage

CuedUp is in structured replay proof plus listening sandbox stage.

Canonical repo:

`C:\Users\dillo\Desktop\CuedUp`

That Desktop repo is the only real working copy.

## 2. What Is Already Built

- Next.js + TypeScript app scaffold
- sparse live surface kept intentionally quiet
- separate replay/debug route
- deterministic conversation-state engine
- Presence Guard
- canonical replay timeline builder
- manual replay transcript append
- replay JSON transcript import
- replay fixture loading and seeded reset
- three replay fixtures
- validation guide and checkpoint navigation
- proof summary and export
- debug-only listening sandbox
- browser-local replay session restore
- browser-local proof session restore
- browser-local listening draft/segment restore
- segment-aware transcript sandbox with explicit commit modes

## 3. What Was Just Fixed

- fixture loading now lands on the loaded snapshot instead of the empty seed state
- replay proof sessions are now structured enough to review fixture runs instead of just eyeballing them
- proof state is now browser-local durable enough to survive refreshes on the same machine
- replay-local sandbox session state is now browser-local durable enough to survive refreshes on the same machine
- listening sandbox draft text is now browser-local durable enough to survive refreshes on the same machine
- listening sandbox now has captured segments, explicit commit modes, clearer support state, and stronger reset controls
- proof export is now useful enough for compact notes, markdown, or JSON copy/download
- `cuedup-launcher.html` is now aligned to the real current phase instead of stale routes and stale priorities

## 4. Current Mission

Prove the engine in replay and make tomorrow's talk-into-it sandbox test real.

That means two things:

1. run the three fixtures and mark what actually happens
2. use the listening sandbox to capture draft transcript text and commit it into the same replay-local turn stream

## 5. What Must Be Proven Now

Replay proof:

- unresolved threads open when they should
- unresolved threads stay open when they should
- unresolved threads cool or resolve when they should
- Presence Guard surfaces a cue only when it should
- Presence Guard suppresses output when it should
- repetition and saturation stay quiet instead of getting noisy

Listening sandbox proof:

- browser listening either starts honestly or fails honestly
- captured or typed draft text is visible and editable
- draft text commits cleanly into replay
- replay state, cue decisions, and thread state update through the same deterministic path after commit

Fixture proof targets:

- `thread-revisit-later`: unresolved thread carryover, reactivation, later payoff
- `evasive-run-pressure`: evasive run suppression, accountability pressure, breakthrough answer
- `saturation-plateau-repeat`: saturation growth, repetition quieting, plateau end-state

## 6. What Is Not Ready Yet

- production live mode wiring
- real transcript streaming
- real ingestion adapters
- backend persistence
- earpiece / earbud workflow
- polished host UX
- anything that depends on production operator trust

## 7. When Mic Testing Becomes Appropriate

Mic testing is appropriate now only inside the debug listening sandbox.

That does **not** mean production live mode is ready.

Tomorrow's mic test is acceptable if:

- the replay route is open
- the listening sandbox is clearly marked experimental
- captured text is treated as draft text until committed
- committed text still flows through the same replay-local timeline path

## 8. Next Real Move

Tomorrow morning:

1. run `npm run dev`
2. open `/interview/mock-session/replay`
3. use the listening sandbox first
4. try browser listening
5. if listening support is weak, type or paste into the draft box instead
6. review captured segments and editable draft text
7. commit draft text into replay
8. inspect thread bank, cue behavior, and decision log
9. then run the three fixtures and mark checkpoints observed or failed

## 9. What Not To Touch Yet

- true live mode
- earpiece ideas
- production streaming claims
- backend persistence
- dashboard growth
- recap polish
- auth, billing, team features
- orchestrator work
- broad refactors that do not strengthen replay proof or the listening sandbox
