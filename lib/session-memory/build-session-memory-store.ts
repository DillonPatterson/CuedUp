import {
  rawTranscriptEventSchema,
  sessionMemoryStoreSchema,
  type RawTranscriptEvent,
} from "@/lib/session-memory/contracts";
import { getMostDroppedThread, getReactivationCandidates, getThreadByKey, getTurnsForThread, getUnresolvedThreads, runSessionRetrievalQuery } from "@/lib/session-memory/retrieval";
import { buildSessionThreads, buildThreadMentions } from "@/lib/session-memory/thread-ledger";
import { assembleCanonicalTurns } from "@/lib/session-memory/turn-assembly";

type BuildSessionMemoryStoreOptions = {
  ignoredEventCount?: number;
};

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function buildSessionMemoryStore(
  sessionId: string,
  rawEvents: RawTranscriptEvent[],
  options: BuildSessionMemoryStoreOptions = {},
) {
  const parsedEvents = rawTranscriptEventSchema.array().parse(
    rawEvents.filter((event) => event.sessionId === sessionId),
  );
  const seenEventIds = new Set<string>();
  let duplicateEventIdsDropped = 0;
  const normalizedEvents = parsedEvents.filter((event) => {
    if (seenEventIds.has(event.id)) {
      duplicateEventIdsDropped += 1;
      return false;
    }

    seenEventIds.add(event.id);
    return true;
  });
  const sessionTurns = assembleCanonicalTurns(normalizedEvents);
  const { mentions, analysisByTurnId } = buildThreadMentions(sessionTurns);
  const sessionThreads = buildSessionThreads(
    sessionId,
    sessionTurns,
    mentions,
    analysisByTurnId,
  );
  const totalFinalEvents = normalizedEvents.filter(
    (event) => event.eventType === "final",
  ).length;
  const totalCanonicalTurns = sessionTurns.length;
  const totalTurnWords = sessionTurns.reduce(
    (total, turn) => total + countWords(turn.text),
    0,
  );
  const averageWordsPerCanonicalTurn =
    totalCanonicalTurns > 0
      ? Number((totalTurnWords / totalCanonicalTurns).toFixed(2))
      : 0;
  const veryShortFinalizedTurnCount = sessionTurns.filter(
    (turn) => countWords(turn.text) <= 3,
  ).length;
  const partialEventsMergedIntoFinals = sessionTurns.reduce(
    (total, turn) => total + turn.partialEventCount,
    0,
  );
  const longestFinalizedTurnWords = sessionTurns.reduce(
    (longest, turn) => Math.max(longest, countWords(turn.text)),
    0,
  );

  return sessionMemoryStoreSchema.parse({
    sessionId,
    session_events: normalizedEvents,
    session_turns: sessionTurns,
    session_thread_mentions: mentions,
    session_threads: sessionThreads,
    diagnostics: {
      totalRawEvents: normalizedEvents.length,
      totalFinalEvents,
      totalCanonicalTurns,
      duplicateEventIdStatus:
        duplicateEventIdsDropped > 0 ? "deduped" : "clear",
      duplicateEventIdsDropped,
      averageWordsPerCanonicalTurn,
      veryShortFinalizedTurnCount,
      partialEventsMergedIntoFinals,
      longestFinalizedTurnWords,
      ignoredEventCount: options.ignoredEventCount ?? 0,
    },
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
