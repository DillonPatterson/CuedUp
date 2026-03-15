# Replay Fixtures

- `thread-revisit-later.json`: opens a meaningful thread early, leaves it hanging, then revisits it later to exercise unresolved-thread carryover and reactivation.
- `evasive-run-pressure.json`: stacks evasive answers around contradiction and trust topics to exercise challenge behavior and cue suppression under weak signal.
- `saturation-plateau-repeat.json`: repeats the same thematic lane with declining novelty to exercise saturation plateau behavior and sparse cueing.

These files are replay-only JSON inputs for the existing transcript loader.

Trust notes:

- each fixture is a JSON array in the same shape expected by replay import
- score fields are explicit on every turn so replay behavior stays deterministic
- fixture loading replaces the replay-local turn stream
- seeded reset is intentionally different and returns replay to the seeded starting state
