import assert from "node:assert/strict";
import {
  appendReplayTranscriptTurns,
  importReplayTranscriptTurns,
  type ReplayTranscriptTurnDraft,
} from "@/lib/transcript/manual-turns";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

function buildDraft(
  source: ReplayTranscriptTurnDraft["source"],
  text: string,
): ReplayTranscriptTurnDraft {
  return {
    source,
    speaker: "guest",
    text,
    energyScore: 0.5,
    specificityScore: 0.6,
    evasionScore: 0.1,
    noveltyScore: 0.5,
    threadIdLink: null,
  };
}

let result = appendReplayTranscriptTurns([], SESSION_ID, [
  buildDraft("manual_replay_input", "  first manual turn  "),
  buildDraft("listening_sandbox_draft", "sandbox draft"),
  buildDraft("listening_sandbox_segment", "sandbox segment"),
  buildDraft("future_live_ingestion", "future live placeholder"),
]);

assert.equal(result.turns.length, 4);
assert.equal(result.turns[0]?.text, "first manual turn");
assert.equal(
  result.metadata[result.turns[0]!.id]?.source,
  "manual_replay_input",
);
assert.equal(
  result.metadata[result.turns[1]!.id]?.source,
  "listening_sandbox_draft",
);
assert.equal(
  result.metadata[result.turns[2]!.id]?.source,
  "listening_sandbox_segment",
);
assert.equal(
  result.metadata[result.turns[3]!.id]?.source,
  "future_live_ingestion",
);
assert.equal(
  result.metadata[result.turns[0]!.id]?.analysis.turnKind,
  "answer",
);
assert.equal(
  result.metadata[result.turns[0]!.id]?.analysis.specificityBand,
  "medium",
);
assert.equal(
  result.metadata[result.turns[0]!.id]?.analysis.cuePotential,
  "medium",
);

result = importReplayTranscriptTurns(result.turns, SESSION_ID, JSON.stringify([
  {
    text: "imported json turn",
  },
]));

const importedTurn = result.turns.at(-1);

assert.ok(importedTurn);
assert.equal(importedTurn?.speaker, "guest");
assert.equal(importedTurn?.energyScore, 0.5);
assert.equal(
  result.metadata[importedTurn!.id]?.source,
  "json_import",
);
assert.equal(
  result.metadata[importedTurn!.id]?.analysis.turnKind,
  "answer",
);
assert.equal(
  result.metadata[importedTurn!.id]?.analysis.threadAction,
  "none",
);

assert.throws(
  () =>
    appendReplayTranscriptTurns([], SESSION_ID, [
      buildDraft("manual_replay_input", "   "),
    ]),
  /cannot be empty/i,
);

assert.throws(
  () => importReplayTranscriptTurns([], SESSION_ID, "{"),
  /valid JSON/i,
);

console.log("Replay ingestion normalization contract passed.");
