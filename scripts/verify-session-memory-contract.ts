import assert from "node:assert/strict";
import {
  buildSessionMemoryStore,
  getMostDroppedThread,
  getReactivationCandidates,
  getTurnsForThread,
  getUnresolvedThreads,
  runSessionRetrievalQuery,
} from "@/lib/session-memory/build-session-memory-store";
import type { RawTranscriptEvent } from "@/lib/session-memory/contracts";
import { assembleCanonicalTurns } from "@/lib/session-memory/turn-assembly";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

function findThreadByLabel(
  store: ReturnType<typeof buildSessionMemoryStore>,
  label: string,
) {
  return store.session_threads.find((thread) => thread.label === label) ?? null;
}

function buildEvent(
  sequence: number,
  text: string,
  overrides: Partial<RawTranscriptEvent> = {},
): RawTranscriptEvent {
  return {
    id: `event-${sequence}`,
    sessionId: SESSION_ID,
    utteranceKey: overrides.utteranceKey ?? `utterance-${sequence}`,
    source: "sandbox_final",
    eventType: "final",
    sequence,
    occurredAt: new Date(Date.UTC(2026, 2, 22, 15, 0, sequence)).toISOString(),
    text,
    confidence: 0.8,
    speaker: "guest",
    speakerConfidence: 1,
    ...overrides,
  };
}

const partialMergeEvents: RawTranscriptEvent[] = [
  buildEvent(1, "His relapse made", {
    utteranceKey: "speech-1",
    source: "sandbox_partial",
    eventType: "partial",
    confidence: 0.45,
  }),
  buildEvent(2, "His relapse made risk feel", {
    utteranceKey: "speech-1",
    source: "sandbox_partial",
    eventType: "partial",
    confidence: 0.5,
  }),
  buildEvent(3, "His relapse made risk feel personal.", {
    utteranceKey: "speech-1",
  }),
];

const mergedTurns = assembleCanonicalTurns(partialMergeEvents);

assert.equal(mergedTurns.length, 1);
assert.equal(mergedTurns[0]?.text, "His relapse made risk feel personal.");
assert.deepEqual(mergedTurns[0]?.sourceEventIds, ["event-1", "event-2", "event-3"]);
assert.deepEqual(mergedTurns[0]?.sourceUtteranceKeys, ["speech-1"]);
assert.equal(mergedTurns[0]?.partialEventCount, 2);
assert.equal(mergedTurns[0]?.finalEventCount, 1);
assert.equal(mergedTurns[0]?.assemblyReason, "end_of_buffer");
assert.match(
  mergedTurns[0]?.id ?? "",
  /^[0-9a-f]{8}-[0-9a-f]{4}-4000-8000-[0-9a-f]{12}$/i,
);

const mergedFinalChunkTurns = assembleCanonicalTurns([
  buildEvent(1, "I was trying to explain", {
    utteranceKey: "merge-1",
  }),
  buildEvent(2, "what changed was the board stepped in.", {
    utteranceKey: "merge-2",
  }),
]);

assert.equal(mergedFinalChunkTurns.length, 1);
assert.equal(
  mergedFinalChunkTurns[0]?.text,
  "I was trying to explain what changed was the board stepped in.",
);
assert.deepEqual(mergedFinalChunkTurns[0]?.sourceUtteranceKeys, [
  "merge-1",
  "merge-2",
]);
assert.equal(mergedFinalChunkTurns[0]?.finalEventCount, 2);
assert.equal(mergedFinalChunkTurns[0]?.assemblyReason, "end_of_buffer");

const outOfOrderTurns = assembleCanonicalTurns([
  buildEvent(4, "Second finalized turn.", { utteranceKey: "speech-2" }),
  buildEvent(1, "First finalized turn.", { utteranceKey: "speech-1" }),
]);

assert.deepEqual(
  outOfOrderTurns.map((turn) => turn.text),
  ["First finalized turn.", "Second finalized turn."],
);

const threadStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "His relapse made risk feel personal.", {
    utteranceKey: "speech-1",
  }),
  buildEvent(2, "I changed my mind because", {
    utteranceKey: "speech-2",
  }),
  buildEvent(3, "Why exactly?", {
    utteranceKey: "speech-3",
    speaker: "host",
  }),
]);
assert.equal(threadStore.diagnostics.totalRawEvents, 3);
assert.equal(threadStore.diagnostics.totalFinalEvents, 3);
assert.equal(threadStore.diagnostics.totalCanonicalTurns, 3);
assert.equal(threadStore.diagnostics.duplicateEventIdStatus, "clear");
assert.equal(threadStore.diagnostics.duplicateEventIdsDropped, 0);
assert.equal(threadStore.diagnostics.partialEventsMergedIntoFinals, 0);
assert.equal(threadStore.diagnostics.veryShortFinalizedTurnCount, 1);
assert.equal(threadStore.diagnostics.longestFinalizedTurnWords, 6);
assert.equal(threadStore.diagnostics.averageWordsPerCanonicalTurn, 4.33);
assert.equal(threadStore.diagnostics.ignoredEventCount, 0);

assert.ok(threadStore.session_thread_mentions.length > 0);
assert.ok(
  threadStore.session_thread_mentions.some(
    (mention) =>
      mention.turnId === threadStore.session_turns[0]?.id &&
      mention.label === "risk",
  ),
);

const unresolvedThreads = getUnresolvedThreads(threadStore, SESSION_ID);
assert.ok(unresolvedThreads.length > 0);
assert.ok(
  unresolvedThreads.some(
    (thread) =>
      thread.label === "risk" ||
      thread.label.startsWith("I changed my mind because"),
  ),
);
const unresolvedQuery = runSessionRetrievalQuery(threadStore, {
  sessionId: SESSION_ID,
  mode: "unresolved_threads",
});
assert.ok(unresolvedQuery.basis.length > 0);

const exactDebtStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "Risk matters here.", {
    utteranceKey: "debt-1",
  }),
]);
assert.equal(findThreadByLabel(exactDebtStore, "risk")?.debtScore, 2);

const interruptedOnlyStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "I changed my mind because", {
    utteranceKey: "speech-1",
  }),
  buildEvent(2, "Why exactly?", {
    utteranceKey: "speech-2",
    speaker: "host",
  }),
]);

const mostDroppedThread = getMostDroppedThread(interruptedOnlyStore, SESSION_ID);
assert.ok(mostDroppedThread);
assert.equal(mostDroppedThread?.label, "I changed my mind because");

const interruptedTurns = getTurnsForThread(
  interruptedOnlyStore,
  SESSION_ID,
  mostDroppedThread!.threadKey,
);
assert.deepEqual(
  interruptedTurns.map((turn) => turn.text),
  ["I changed my mind because"],
);
const mostDroppedQuery = runSessionRetrievalQuery(interruptedOnlyStore, {
  sessionId: SESSION_ID,
  mode: "most_dropped_thread",
});
assert.equal(mostDroppedQuery.threads[0]?.threadKey, mostDroppedThread!.threadKey);
assert.deepEqual(
  mostDroppedQuery.turns.map((turn) => turn.text),
  ["I changed my mind because"],
);

const coolingStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "His relapse made risk feel personal.", {
    utteranceKey: "speech-1",
  }),
  buildEvent(
    2,
    "What changed was I stopped treating family risk like a strategy problem.",
    {
      utteranceKey: "speech-2",
    },
  ),
]);

assert.ok(
  coolingStore.session_threads.some(
    (thread) => thread.label === "risk" && thread.status === "cooling",
  ),
);
assert.ok(
  !getReactivationCandidates(coolingStore, SESSION_ID).some(
    (thread) => thread.label === "risk",
  ),
);
const reactivationQuery = runSessionRetrievalQuery(coolingStore, {
  sessionId: SESSION_ID,
  mode: "reactivation_candidates",
});
assert.ok(reactivationQuery.basis.length > 0);
assert.ok(!reactivationQuery.threads.some((thread) => thread.label === "risk"));

const resolvedStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "His relapse made risk feel personal.", {
    utteranceKey: "resolve-1",
  }),
  buildEvent(
    2,
    "What changed was I stopped treating family risk like a strategy problem.",
    {
      utteranceKey: "resolve-2",
    },
  ),
  buildEvent(3, "The board wanted a cleaner narrative.", {
    utteranceKey: "resolve-3",
  }),
  buildEvent(4, "Mission discipline mattered after that.", {
    utteranceKey: "resolve-4",
  }),
  buildEvent(5, "Accountability felt different after the shift.", {
    utteranceKey: "resolve-5",
  }),
]);
assert.equal(findThreadByLabel(resolvedStore, "risk")?.status, "resolved");
assert.equal(findThreadByLabel(resolvedStore, "risk")?.dropScore, 0);

const retrievalOrderingStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "Risk mattered immediately.", {
    utteranceKey: "order-1",
  }),
  buildEvent(2, "Okay.", {
    utteranceKey: "order-2",
  }),
  buildEvent(3, "Fine.", {
    utteranceKey: "order-3",
  }),
  buildEvent(4, "Later.", {
    utteranceKey: "order-4",
  }),
  buildEvent(5, "It was about the board and...", {
    utteranceKey: "order-5",
  }),
]);
const orderedUnresolved = getUnresolvedThreads(retrievalOrderingStore, SESSION_ID);
const unresolvedRiskIndex = orderedUnresolved.findIndex(
  (thread) => thread.label === "risk",
);
const unresolvedTruncatedIndex = orderedUnresolved.findIndex(
  (thread) => thread.label.includes("board"),
);
assert.ok(unresolvedTruncatedIndex >= 0);
assert.ok(unresolvedRiskIndex >= 0);
assert.ok(unresolvedTruncatedIndex < unresolvedRiskIndex);
const orderedReactivation = getReactivationCandidates(
  retrievalOrderingStore,
  SESSION_ID,
);
const reactivationRiskIndex = orderedReactivation.findIndex(
  (thread) => thread.label === "risk",
);
const reactivationTruncatedIndex = orderedReactivation.findIndex(
  (thread) => thread.label.includes("board"),
);
assert.ok(reactivationRiskIndex >= 0);
assert.ok(reactivationTruncatedIndex >= 0);
assert.ok(reactivationRiskIndex < reactivationTruncatedIndex);

const reactivatedStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "Risk felt personal.", {
    utteranceKey: "reactivate-1",
  }),
  buildEvent(2, "We moved on too quickly.", {
    utteranceKey: "reactivate-2",
  }),
  buildEvent(3, "The downside still feels like risk.", {
    utteranceKey: "reactivate-3",
  }),
  buildEvent(4, "Mission came up after that.", {
    utteranceKey: "reactivate-4",
  }),
]);
const reactivatedRisk = findThreadByLabel(reactivatedStore, "risk");
assert.equal(reactivatedRisk?.mentionCount, 2);
assert.equal(
  reactivatedRisk?.lastMentionTurnId,
  reactivatedStore.session_turns[2]?.id,
);
assert.deepEqual(
  getTurnsForThread(reactivatedStore, SESSION_ID, reactivatedRisk!.threadKey).map(
    (turn) => turn.text,
  ),
  ["Risk felt personal.", "The downside still feels like risk."],
);

const fragmentedIdentityStore = buildSessionMemoryStore(SESSION_ID, [
  buildEvent(1, "I changed my mind because the board got involved.", {
    utteranceKey: "fragment-1",
  }),
  buildEvent(2, "I changed my mind because leadership folded.", {
    utteranceKey: "fragment-2",
  }),
]);
const fragmentedClaims = fragmentedIdentityStore.session_threads.filter(
  (thread) =>
    thread.sourceKind === "claim" &&
    thread.label.startsWith("I changed my mind because"),
);
assert.equal(fragmentedClaims.length, 2);

const dedupedStore = buildSessionMemoryStore(
  SESSION_ID,
  [
    buildEvent(1, "Board risk kept growing.", {
      utteranceKey: "dedupe-1",
      id: "duplicate-event",
    }),
    buildEvent(2, "Board risk kept growing.", {
      utteranceKey: "dedupe-1",
      id: "duplicate-event",
    }),
  ],
  {
    ignoredEventCount: 2,
  },
);
assert.equal(dedupedStore.diagnostics.duplicateEventIdStatus, "deduped");
assert.equal(dedupedStore.diagnostics.duplicateEventIdsDropped, 1);
assert.equal(dedupedStore.diagnostics.totalRawEvents, 1);
assert.equal(dedupedStore.diagnostics.totalFinalEvents, 1);
assert.equal(dedupedStore.diagnostics.totalCanonicalTurns, 1);
assert.equal(dedupedStore.diagnostics.ignoredEventCount, 2);

console.log("Session memory contract passed.");
