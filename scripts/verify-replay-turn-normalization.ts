import assert from "node:assert/strict";
import {
  appendReplayTranscriptTurns,
  importReplayTranscriptTurns,
  type ReplayTranscriptTurnDraft,
} from "@/lib/transcript/manual-turns";
import { buildReplayTranscriptOrganization } from "@/lib/transcript/organization/build-session-organization";

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

function buildOrganizationForDraft(
  draft: ReplayTranscriptTurnDraft,
) {
  const replayAppendResult = appendReplayTranscriptTurns([], SESSION_ID, [draft]);

  return buildReplayTranscriptOrganization(
    replayAppendResult.turns,
    replayAppendResult.metadata,
  );
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
assert.equal(
  result.metadata[result.turns[0]!.id]?.memory.memoryKind,
  "fact",
);
assert.deepEqual(
  result.metadata[result.turns[0]!.id]?.memory.entities,
  [],
);
assert.ok(
  !("memory" in result.turns[0]!),
  "TranscriptTurn shape should remain engine-facing and memory-free.",
);
const firstTurnOrganization = buildReplayTranscriptOrganization(
  result.turns,
  result.metadata,
);
assert.deepEqual(
  firstTurnOrganization.annotationsByTurnId[result.turns[0]!.id]?.map(
    (annotation) => ({
      kind: annotation.kind,
      label: annotation.label,
      salience: annotation.salience,
    }),
  ),
  [
    {
      kind: "claim",
      label: "first manual turn",
      salience: "low",
    },
  ],
);
assert.deepEqual(
  buildReplayTranscriptOrganization(result.turns, {}),
  firstTurnOrganization,
);

const crossSourceText = "My brother made risk feel personal.";
const crossSourceResult = appendReplayTranscriptTurns([], SESSION_ID, [
  buildDraft("manual_replay_input", crossSourceText),
  buildDraft("listening_sandbox_draft", crossSourceText),
  buildDraft("listening_sandbox_segment", crossSourceText),
]);

const manualMemory =
  crossSourceResult.metadata[crossSourceResult.turns[0]!.id]?.memory;
const sandboxDraftMemory =
  crossSourceResult.metadata[crossSourceResult.turns[1]!.id]?.memory;
const sandboxSegmentMemory =
  crossSourceResult.metadata[crossSourceResult.turns[2]!.id]?.memory;

assert.deepEqual(sandboxDraftMemory, manualMemory);
assert.deepEqual(sandboxSegmentMemory, manualMemory);
assert.equal(manualMemory?.memoryKind, "relationship");
assert.equal(manualMemory?.salience, "medium");
assert.deepEqual(manualMemory?.entities, ["Brother"]);
assert.deepEqual(manualMemory?.themes, ["risk", "family", "emotion"]);
assert.deepEqual(manualMemory?.claims, [crossSourceText]);

const manualOrganization = buildOrganizationForDraft(
  buildDraft("manual_replay_input", crossSourceText),
);
const sandboxDraftOrganization = buildOrganizationForDraft(
  buildDraft("listening_sandbox_draft", crossSourceText),
);
const sandboxSegmentOrganization = buildOrganizationForDraft(
  buildDraft("listening_sandbox_segment", crossSourceText),
);

assert.deepEqual(sandboxDraftOrganization, manualOrganization);
assert.deepEqual(sandboxSegmentOrganization, manualOrganization);
assert.deepEqual(manualOrganization.summary, {
  entities: ["Brother"],
  themes: ["risk", "family", "emotion"],
  claims: [crossSourceText],
  unresolvedThreadCues: [],
  tensions: [],
});
assert.deepEqual(manualOrganization.emergingThemes, []);
assert.equal(manualOrganization.openThreads.length, 0);
assert.deepEqual(
  manualOrganization.notableClaims.map((item) => item.label),
  [crossSourceText],
);
assert.equal(manualOrganization.tensionWatch.length, 0);
assert.deepEqual(
  manualOrganization.recallCandidates.map((candidate) => ({
    label: candidate.label,
    sourceKind: candidate.sourceKind,
    recency: candidate.recency,
    relevanceToCurrentTurn: candidate.relevanceToCurrentTurn,
    readiness: candidate.readiness,
  })),
  [
    {
      label: crossSourceText,
      sourceKind: "claim",
      recency: "fresh",
      relevanceToCurrentTurn: "high",
      readiness: "urgent",
    },
  ],
);
assert.deepEqual(
  manualOrganization.annotations.map((annotation) => annotation.kind),
  ["entity", "theme", "theme", "theme", "claim"],
);
assert.deepEqual(
  manualOrganization.retrievalRecords.map((record) => ({
    itemKind: record.itemKind,
    annotationKind: record.annotationKind,
    lookupText: record.lookupText,
  })),
  [
    {
      itemKind: "turn",
      annotationKind: null,
      lookupText: crossSourceText,
    },
    {
      itemKind: "annotation",
      annotationKind: "entity",
      lookupText: "Brother",
    },
    {
      itemKind: "annotation",
      annotationKind: "theme",
      lookupText: "risk",
    },
    {
      itemKind: "annotation",
      annotationKind: "theme",
      lookupText: "family",
    },
    {
      itemKind: "annotation",
      annotationKind: "theme",
      lookupText: "emotion",
    },
    {
      itemKind: "annotation",
      annotationKind: "claim",
      lookupText: crossSourceText,
    },
  ],
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
assert.equal(
  result.metadata[importedTurn!.id]?.memory.memoryKind,
  "fact",
);
assert.equal(
  result.metadata[importedTurn!.id]?.memory.salience,
  "low",
);
assert.deepEqual(
  result.metadata[importedTurn!.id]?.memory.contradictionSignals,
  [],
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
