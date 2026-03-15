import assert from "node:assert/strict";
import { buildMockDossier } from "@/lib/dossier/mock";
import {
  appendReplayTranscriptTurns,
  importReplayTranscriptTurns,
  type ReplayTranscriptTurnDraft,
} from "@/lib/transcript/manual-turns";
import { buildReplayTranscriptOrganization } from "@/lib/transcript/organization/build-session-organization";
import { createDossierLiveHandoff } from "@/lib/state/dossier-handoff";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

function buildDraft(
  source: ReplayTranscriptTurnDraft["source"],
  text: string,
  overrides: Partial<ReplayTranscriptTurnDraft> = {},
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
    ...overrides,
  };
}

function buildMockHandoff() {
  return createDossierLiveHandoff(
    buildMockDossier({
      guestId: "00000000-0000-4000-8000-000000000099",
      guestSlug: "guest",
      guestName: "Guest",
      title: "Mock dossier",
      interviewFocus: "Trust, reinvention, and accountability",
      notes: "",
      sources: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          mode: "notes",
          title: "Mill collapse",
          content: "The guest ties reinvention to the mill collapse and family risk.",
          notes: "",
          tags: [],
        },
        {
          id: "00000000-0000-4000-8000-000000000102",
          mode: "notes",
          title: "Public markets",
          content:
            "The guest said public scrutiny could sharpen the mission but once distrusted the stage.",
          notes: "",
          tags: [],
        },
        {
          id: "00000000-0000-4000-8000-000000000103",
          mode: "notes",
          title: "Brother",
          content: "Her brother's relapse made trust and risk feel personal.",
          notes: "",
          tags: [],
        },
      ],
    }),
  );
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

function findDebt(
  organization: ReturnType<typeof buildReplayTranscriptOrganization>,
  label: string,
) {
  return organization.completionDebt.find((entry) => entry.label === label);
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
  result.metadata[result.turns[0]!.id]?.analysis.affective.dominantEmotion,
  "neutral",
);
assert.equal(
  result.metadata[result.turns[0]!.id]?.analysis.completion.completionStatus,
  "truncated",
);
assert.equal(
  result.metadata[result.turns[0]!.id]?.analysis.interruption.interruptedPreviousTurn,
  false,
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

const affectiveText = "His relapse made risk feel personal.";
const crossSourceResult = appendReplayTranscriptTurns([], SESSION_ID, [
  buildDraft("manual_replay_input", affectiveText),
  buildDraft("listening_sandbox_draft", affectiveText),
  buildDraft("listening_sandbox_segment", affectiveText),
]);

const manualMetadata =
  crossSourceResult.metadata[crossSourceResult.turns[0]!.id];
const sandboxDraftMetadata =
  crossSourceResult.metadata[crossSourceResult.turns[1]!.id];
const sandboxSegmentMetadata =
  crossSourceResult.metadata[crossSourceResult.turns[2]!.id];

assert.deepEqual(
  sandboxDraftMetadata?.analysis.affective,
  manualMetadata?.analysis.affective,
);
assert.deepEqual(
  sandboxDraftMetadata?.memory,
  manualMetadata?.memory,
);
assert.deepEqual(
  sandboxSegmentMetadata?.analysis.affective,
  manualMetadata?.analysis.affective,
);
assert.deepEqual(
  sandboxSegmentMetadata?.memory,
  manualMetadata?.memory,
);
assert.equal(manualMetadata?.memory.memoryKind, "relationship");
assert.equal(manualMetadata?.memory.salience, "medium");
assert.equal(manualMetadata?.analysis.affective.dominantEmotion, "fear");
assert.equal(manualMetadata?.analysis.affective.intensity, "high");
assert.equal(manualMetadata?.analysis.affective.valence, "negative");
assert.ok(
  manualMetadata?.analysis.affective.triggerTerms.some(
    (hit) => hit.term === "relapse",
  ),
);
assert.ok(
  manualMetadata?.analysis.affective.triggerTerms.some(
    (hit) => hit.term === "risk",
  ),
);
assert.ok(
  manualMetadata?.analysis.affective.triggerTerms.some(
    (hit) => hit.term === "personal",
  ),
);

const manualOrganization = buildOrganizationForDraft(
  buildDraft("manual_replay_input", affectiveText),
);
const sandboxDraftOrganization = buildOrganizationForDraft(
  buildDraft("listening_sandbox_draft", affectiveText),
);
const sandboxSegmentOrganization = buildOrganizationForDraft(
  buildDraft("listening_sandbox_segment", affectiveText),
);

assert.deepEqual(sandboxDraftOrganization, manualOrganization);
assert.deepEqual(sandboxSegmentOrganization, manualOrganization);
assert.deepEqual(manualOrganization.summary, {
  entities: [],
  themes: ["risk", "family", "emotion"],
  claims: [affectiveText],
  unresolvedThreadCues: [],
  tensions: [],
});
assert.deepEqual(manualOrganization.emergingThemes, []);
assert.equal(manualOrganization.openThreads.length, 0);
assert.deepEqual(
  manualOrganization.notableClaims.map((item) => item.label),
  [affectiveText],
);
assert.equal(manualOrganization.tensionWatch.length, 0);
assert.deepEqual(
  manualOrganization.recallCandidates.map((candidate) => ({
    label: candidate.label,
    sourceKind: candidate.sourceKind,
    recency: candidate.recency,
    relevanceToCurrentTurn: candidate.relevanceToCurrentTurn,
    readiness: candidate.readiness,
    completionDebtScore: candidate.completionDebtScore,
  })),
  [
    {
      label: affectiveText,
      sourceKind: "claim",
      recency: "fresh",
      relevanceToCurrentTurn: "high",
      readiness: "urgent",
      completionDebtScore: 2,
    },
  ],
);
assert.equal(
  manualOrganization.nextNudge.bestCandidate?.id,
  "next-nudge:recall:bucket:claim:his relapse made risk feel personal",
);
assert.equal(manualOrganization.nextNudge.bestCandidate?.label, affectiveText);
assert.equal(
  manualOrganization.nextNudge.bestCandidate?.sourceKind,
  "claim",
);
assert.equal(
  manualOrganization.nextNudge.bestCandidate?.promptAngle,
  "press_gently",
);
assert.equal(
  manualOrganization.nextNudge.bestCandidate?.readiness,
  "urgent",
);
assert.equal(manualOrganization.nextNudge.bestCandidate?.debtScore, 2);
assert.equal(
  manualOrganization.nextNudge.bestCandidate?.affectiveWeight,
  "high",
);
assert.equal(
  manualOrganization.nextNudge.bestCandidate?.interrupted,
  false,
);
assert.ok(
  manualOrganization.nextNudge.bestCandidate?.reason.includes("affective weight"),
);
assert.ok(
  manualOrganization.nextNudge.bestCandidate?.reason.includes("high relevance"),
);
assert.deepEqual(
  manualOrganization.nextNudge.bestCandidate?.supportingTurnIds,
  [manualOrganization.recallCandidates[0]!.turnIds[0]!],
);
assert.equal(manualOrganization.nextNudge.backupCandidates.length, 0);
assert.deepEqual(
  manualOrganization.annotations.map((annotation) => annotation.kind),
  ["theme", "theme", "theme", "claim"],
);

const dossierHandoff = buildMockHandoff();
const dossierOrganization = buildReplayTranscriptOrganization(
  [crossSourceResult.turns[0]!],
  {
    [crossSourceResult.turns[0]!.id]: manualMetadata!,
  },
  { handoff: dossierHandoff },
);

assert.ok(
  dossierOrganization.sourceMetadataByTurnId[crossSourceResult.turns[0]!.id]
    ?.analysis.lexical.hits.some((hit) => hit.source === "dossier"),
);

const incompleteAnalysis =
  buildOrganizationForDraft(
    buildDraft("manual_replay_input", "I changed my mind because"),
  ).sourceMetadataByTurnId["00000000-0000-4000-8000-000000000001"]?.analysis;

assert.equal(incompleteAnalysis?.completion.completionStatus, "incomplete");
assert.ok(
  incompleteAnalysis?.completion.reasons.includes("endsWithConnector"),
);

const truncatedAnalysis =
  buildOrganizationForDraft(
    buildDraft("manual_replay_input", "It was about the board and..."),
  ).sourceMetadataByTurnId["00000000-0000-4000-8000-000000000001"]?.analysis;

assert.equal(truncatedAnalysis?.completion.completionStatus, "truncated");
assert.ok(
  truncatedAnalysis?.completion.reasons.includes("endsWithEllipsis"),
);

const fragmentAnalysis =
  buildOrganizationForDraft(
    buildDraft("manual_replay_input", "Not really"),
  ).sourceMetadataByTurnId["00000000-0000-4000-8000-000000000001"]?.analysis;

assert.equal(fragmentAnalysis?.completion.completionStatus, "truncated");
assert.ok(
  fragmentAnalysis?.completion.reasons.includes("veryShortFragment"),
);

const interruptionResult = appendReplayTranscriptTurns([], SESSION_ID, [
  buildDraft("manual_replay_input", "I changed my mind because"),
  buildDraft("manual_replay_input", "Why exactly?", {
    speaker: "host",
  }),
]);

assert.equal(
  interruptionResult.metadata[interruptionResult.turns[1]!.id]?.analysis.interruption
    .interruptedPreviousTurn,
  true,
);
assert.equal(
  interruptionResult.metadata[interruptionResult.turns[1]!.id]?.analysis.interruption
    .reason,
  "unfinishedSpeakerSwitch",
);

const debtTurns = appendReplayTranscriptTurns([], SESSION_ID, [
  buildDraft("manual_replay_input", "His relapse made risk feel personal."),
  buildDraft("manual_replay_input", "What changed after that?", {
    speaker: "host",
  }),
  buildDraft("manual_replay_input", "I changed my mind because"),
  buildDraft("manual_replay_input", "Why exactly?", {
    speaker: "host",
  }),
]);

const debtBeforeResolution = buildReplayTranscriptOrganization(
  debtTurns.turns,
  debtTurns.metadata,
);
const interruptedClaimDebt = findDebt(
  debtBeforeResolution,
  "I changed my mind because",
);

assert.ok(interruptedClaimDebt);
assert.ok((interruptedClaimDebt?.debtScore ?? 0) >= 4);
assert.ok(interruptedClaimDebt?.debtReasons.includes("incomplete_turn"));
assert.ok(interruptedClaimDebt?.debtReasons.includes("interruption"));
assert.equal(interruptedClaimDebt?.interrupted, true);
assert.equal(
  debtBeforeResolution.nextNudge.bestCandidate?.sourceKind,
  "interruption",
);
assert.equal(
  debtBeforeResolution.nextNudge.bestCandidate?.promptAngle,
  "return_to_interruption",
);
assert.equal(
  debtBeforeResolution.nextNudge.bestCandidate?.label,
  "I changed my mind because",
);

const resolvedTurns = appendReplayTranscriptTurns(debtTurns.turns, SESSION_ID, [
  buildDraft(
    "manual_replay_input",
    "What changed was I stopped treating family risk like a strategy problem.",
  ),
]);
const debtAfterResolution = buildReplayTranscriptOrganization(
  resolvedTurns.turns,
  {
    ...debtTurns.metadata,
    ...resolvedTurns.metadata,
  },
);
const riskDebtBefore = findDebt(debtBeforeResolution, "risk");
const riskDebtAfter = findDebt(debtAfterResolution, "risk");

assert.ok(riskDebtBefore);
assert.ok(riskDebtAfter);
assert.ok((riskDebtAfter?.debtScore ?? 0) < (riskDebtBefore?.debtScore ?? 0));
assert.ok(riskDebtAfter?.debtReasons.includes("resolution_language"));
assert.equal(
  debtAfterResolution.nextNudge.bestCandidate?.sourceKind,
  "tension",
);
assert.equal(
  debtAfterResolution.nextNudge.bestCandidate?.promptAngle,
  "test_contradiction",
);
assert.equal(
  debtAfterResolution.nextNudge.bestCandidate?.label,
  "accountability_pressure",
);

result = importReplayTranscriptTurns(
  result.turns,
  SESSION_ID,
  JSON.stringify([
    {
      text: "imported json turn",
    },
  ]),
);

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
  result.metadata[importedTurn!.id]?.analysis.completion.completionStatus,
  "truncated",
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
