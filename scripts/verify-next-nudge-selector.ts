import assert from "node:assert/strict";
import { selectNextNudgeSelection } from "@/lib/live/next-nudge-selector";
import type {
  TranscriptOrganizationSnapshot,
  TranscriptRecallCandidate,
} from "@/lib/transcript/organization/types";

type SelectorInput = Parameters<typeof selectNextNudgeSelection>[0];

function buildRecallCandidate(
  overrides: Partial<TranscriptRecallCandidate> = {},
): TranscriptRecallCandidate {
  return {
    id: "recall:default",
    label: "default signal",
    sourceKind: "claim",
    turnIds: ["turn-1"],
    salience: "medium",
    recency: "fresh",
    lastSeenAt: "2026-03-17T10:00:00.000Z",
    relevanceToCurrentTurn: "medium",
    readiness: "ready",
    completionDebtScore: 0,
    completionDebtReasons: [],
    interrupted: false,
    affectiveWeight: "low",
    reason: "default selector signal",
    ...overrides,
  };
}

function buildOrganization(
  overrides: Partial<SelectorInput> = {},
): SelectorInput {
  const base: TranscriptOrganizationSnapshot = {
    sessionId: "selector-test",
    sourceMetadataByTurnId: {},
    annotations: [],
    annotationsByTurnId: {},
    emergingThemes: [],
    openThreads: [],
    notableClaims: [],
    tensionWatch: [],
    completionDebt: [],
    recallCandidates: [],
    nextNudge: {
      bestCandidate: null,
      backupCandidates: [],
    },
    summary: {
      entities: [],
      themes: [],
      claims: [],
      unresolvedThreadCues: [],
      tensions: [],
    },
  };

  return {
    ...base,
    ...overrides,
  };
}

const interruptionSelection = selectNextNudgeSelection(
  buildOrganization({
    recallCandidates: [
      buildRecallCandidate({
        id: "recall:interruption",
        label: "I changed my mind because",
        sourceKind: "claim",
        interrupted: true,
        completionDebtScore: 5,
        readiness: "urgent",
        relevanceToCurrentTurn: "high",
        reason: "unfinished thread with high debt",
      }),
    ],
  }),
);

assert.ok(interruptionSelection.bestCandidate);
assert.equal(interruptionSelection.bestCandidate?.sourceKind, "interruption");
assert.equal(
  interruptionSelection.bestCandidate?.promptAngle,
  "return_to_interruption",
);

const tensionSelection = selectNextNudgeSelection(
  buildOrganization({
    recallCandidates: [
      buildRecallCandidate({
        id: "recall:tension",
        label: "accountability_pressure",
        sourceKind: "tension",
        salience: "high",
        readiness: "ready",
        relevanceToCurrentTurn: "high",
        reason: "tension remains unresolved",
      }),
    ],
  }),
);

assert.ok(tensionSelection.bestCandidate);
assert.equal(tensionSelection.bestCandidate?.sourceKind, "tension");
assert.equal(
  tensionSelection.bestCandidate?.promptAngle,
  "test_contradiction",
);

const threadSelection = selectNextNudgeSelection(
  buildOrganization({
    recallCandidates: [
      buildRecallCandidate({
        id: "recall:thread",
        label: "mill collapse",
        sourceKind: "thread_cue",
        salience: "high",
        readiness: "ready",
        relevanceToCurrentTurn: "high",
        reason: "thread is active again",
      }),
    ],
  }),
);

assert.ok(threadSelection.bestCandidate);
assert.equal(threadSelection.bestCandidate?.sourceKind, "thread");
assert.equal(threadSelection.bestCandidate?.promptAngle, "circle_back");

const weakCandidateFallbackSelection = selectNextNudgeSelection(
  buildOrganization({
    recallCandidates: [
      buildRecallCandidate({
        id: "recall:weak-theme",
        label: "general pressure",
        sourceKind: "theme",
        salience: "low",
        recency: "stale",
        readiness: "not_ready",
        relevanceToCurrentTurn: "low",
        reason: "weak stale theme",
      }),
    ],
  }),
);

assert.ok(weakCandidateFallbackSelection.bestCandidate);
assert.equal(
  weakCandidateFallbackSelection.bestCandidate?.sourceKind,
  "directive",
);
assert.equal(
  weakCandidateFallbackSelection.bestCandidate?.promptAngle,
  "let_it_breathe",
);

console.log("Next nudge selector routing contract passed.");
