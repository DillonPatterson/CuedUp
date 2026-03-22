import {
  rawTranscriptEventSchema,
  sessionMemoryStoreSchema,
  type RawTranscriptEvent,
} from "@/lib/session-memory/contracts";
import { getMostDroppedThread, getReactivationCandidates, getThreadByKey, getTurnsForThread, getUnresolvedThreads, runSessionRetrievalQuery } from "@/lib/session-memory/retrieval";
import { buildSessionThreads, buildThreadMentions } from "@/lib/session-memory/thread-ledger";
import { assembleCanonicalTurns } from "@/lib/session-memory/turn-assembly";

export function buildSessionMemoryStore(
  sessionId: string,
  rawEvents: RawTranscriptEvent[],
) {
  const normalizedEvents = rawTranscriptEventSchema.array().parse(
    rawEvents.filter((event) => event.sessionId === sessionId),
  );
  const sessionTurns = assembleCanonicalTurns(normalizedEvents);
  const { mentions, analysisByTurnId } = buildThreadMentions(sessionTurns);
  const sessionThreads = buildSessionThreads(
    sessionId,
    sessionTurns,
    mentions,
    analysisByTurnId,
  );

  return sessionMemoryStoreSchema.parse({
    sessionId,
    session_events: normalizedEvents,
    session_turns: sessionTurns,
    session_thread_mentions: mentions,
    session_threads: sessionThreads,
  });
}

export {
  getMostDroppedThread,
  getReactivationCandidates,
  getThreadByKey,
  getTurnsForThread,
  getUnresolvedThreads,
  runSessionRetrievalQuery,
};
