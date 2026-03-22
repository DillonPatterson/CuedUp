# Phase 1 Session Memory Spec

This note is the repo-local truth for the current Phase 1 session-memory spine.
It narrows the broader engine concept into what is actually implemented today.

## Phase 1 Purpose

Phase 1 proves one thing:

- transcript-like debug input can be assembled into stable turns
- stable turns can be converted into structured session memory
- unresolved or dropped conversational material can be retrieved from that memory

It does not claim production live behavior.

## Current Phase 1 Objects

- `RawTranscriptEvent`
- `CanonicalTurn`
- `ThreadMention`
- `SessionThread`
- `SessionRetrievalQuery`
- `SessionRetrievalResult`

## Current Phase 1 Truths

### Meaning extraction

Phase 1 uses pattern-assisted deterministic extraction through the existing
transcript analysis and replay memory rules.

It does **not** implement generalized bounded-intelligence extraction.
There is no broad model-driven meaning layer in the Phase 1 spine.

### Thread model

Phase 1 `SessionThread` status is intentionally only:

- `open`
- `cooling`
- `resolved`

This is smaller than the richer engine concept lifecycle. States such as
`deferred`, `dodged`, `dropped`, `stale`, and `suppressed` are not current
ledger truth in Phase 1.

### Retrieval model

Phase 1 retrieval is not a full `RetrievalCandidate` scoring system.

Current retrieval is grounded in the `SessionThread` ledger and uses simple,
inspectable sorting:

- unresolved threads: `debtScore`, then `dropScore`
- reactivation candidates: `dropScore`, then `debtScore`
- exact thread lookup: direct `threadKey` match
- supporting turns: `mentionTurnIds -> CanonicalTurn[]`

### Retrieval explanation

Phase 1 retrieval explains itself with a `basis: string[]` field on
`SessionRetrievalResult`.

This is a lightweight explanation of ranking basis, not a full reasoning chain.

## Debug-Only Boundary

`CanonicalTurn` is a debug-ingestion assembled-turn contract.
It is not the repo's canonical conversation truth.

Current canonical conversation truth remains `TranscriptTurn`.

Phase 1 uses an explicit adapter from `CanonicalTurn` into the existing
transcript-analysis boundary so the overlap is visible and contained.

## Overlap Risks

### `CanonicalTurn` vs `TranscriptTurn`

This is temporary coexistence, but still architecture debt.

Overlap:

- id
- session id
- speaker
- text
- finalized timing
- stable turn order

Difference:

- `CanonicalTurn` carries assembly lineage and confidence fields
- `TranscriptTurn` carries replay scoring fields used by the current analyzer

Current rule:

- `CanonicalTurn` stays debug-only in Phase 1
- `TranscriptTurn` remains canonical truth

### `ConversationThread` vs `SessionThread`

This is also temporary coexistence, with unresolved integration debt.

- `ConversationThread` belongs to the seeded conversation-state engine
- `SessionThread` belongs to the replay-only session-memory proof

They currently model adjacent ideas at different seams and do not unify yet.
Phase 1 does not attempt to merge them.

## Phase 2+ Concepts, Not Current Truth

These remain future concepts and should not be treated as Phase 1 behavior:

- richer thread lifecycle beyond `open/cooling/resolved`
- generalized meaning extraction or model-assisted classification loops
- full `RetrievalCandidate` scoring object
- live-mode session-memory integration
- production persistence
- vector search / embeddings / RAG
- audio delivery timing stack
