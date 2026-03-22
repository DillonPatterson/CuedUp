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
assert.match(
  mergedTurns[0]?.id ?? "",
  /^[0-9a-f]{8}-[0-9a-f]{4}-4000-8000-[0-9a-f]{12}$/i,
);

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
  unresolvedThreads.some((thread) => thread.label === "I changed my mind because"),
);
const unresolvedQuery = runSessionRetrievalQuery(threadStore, {
  sessionId: SESSION_ID,
  mode: "unresolved_threads",
});
assert.ok(unresolvedQuery.basis.length > 0);

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

const resolvedStore = buildSessionMemoryStore(SESSION_ID, [
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
  resolvedStore.session_threads.some(
    (thread) => thread.label === "risk" && thread.status === "cooling",
  ),
);
assert.ok(
  !getReactivationCandidates(resolvedStore, SESSION_ID).some(
    (thread) => thread.label === "risk",
  ),
);
const reactivationQuery = runSessionRetrievalQuery(resolvedStore, {
  sessionId: SESSION_ID,
  mode: "reactivation_candidates",
});
assert.ok(reactivationQuery.basis.length > 0);
assert.ok(!reactivationQuery.threads.some((thread) => thread.label === "risk"));

console.log("Session memory contract passed.");
