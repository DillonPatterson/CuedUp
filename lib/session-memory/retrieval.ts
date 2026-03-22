import {
  sessionRetrievalResultSchema,
  type CanonicalTurn,
  type SessionMemoryStore,
  type SessionRetrievalQuery,
} from "@/lib/session-memory/contracts";

function getSessionThreads(store: SessionMemoryStore, sessionId: string) {
  return store.sessionId === sessionId ? store.session_threads : [];
}

function getSessionTurns(store: SessionMemoryStore, sessionId: string) {
  return store.sessionId === sessionId ? store.session_turns : [];
}

function getSessionMentions(store: SessionMemoryStore, sessionId: string) {
  return store.sessionId === sessionId ? store.session_thread_mentions : [];
}

function sortByTurnSequence(
  turns: CanonicalTurn[],
) {
  return [...turns].sort((left, right) => left.sequence - right.sequence);
}

export function getUnresolvedThreads(
  store: SessionMemoryStore,
  sessionId: string,
) {
  return getSessionThreads(store, sessionId)
    .filter((thread) => thread.status === "open")
    .sort((left, right) => right.debtScore - left.debtScore || right.dropScore - left.dropScore);
}

export function getMostDroppedThread(
  store: SessionMemoryStore,
  sessionId: string,
) {
  return getUnresolvedThreads(store, sessionId)[0] ?? null;
}

export function getThreadByKey(
  store: SessionMemoryStore,
  sessionId: string,
  threadKey: string,
) {
  return getSessionThreads(store, sessionId).find((thread) => thread.threadKey === threadKey) ?? null;
}

export function getReactivationCandidates(
  store: SessionMemoryStore,
  sessionId: string,
) {
  return getSessionThreads(store, sessionId)
    .filter((thread) => thread.status === "open" && thread.dropScore > 0)
    .sort((left, right) => right.dropScore - left.dropScore || right.debtScore - left.debtScore);
}

export function getTurnsForThread(
  store: SessionMemoryStore,
  sessionId: string,
  threadKey: string,
) {
  const thread = getThreadByKey(store, sessionId, threadKey);

  if (!thread) {
    return [];
  }

  const turnsById = getSessionTurns(store, sessionId).reduce<Record<string, CanonicalTurn>>(
    (result, turn) => {
      result[turn.id] = turn;
      return result;
    },
    {},
  );

  return sortByTurnSequence(
    thread.mentionTurnIds
      .map((turnId) => turnsById[turnId])
      .filter((turn): turn is CanonicalTurn => Boolean(turn)),
  );
}

export function runSessionRetrievalQuery(
  store: SessionMemoryStore,
  query: SessionRetrievalQuery,
) {
  const mentions = getSessionMentions(store, query.sessionId);

  switch (query.mode) {
    case "unresolved_threads":
      return sessionRetrievalResultSchema.parse({
        query,
        threads: getUnresolvedThreads(store, query.sessionId),
        turns: [],
        mentions,
      });
    case "most_dropped_thread": {
      const thread = getMostDroppedThread(store, query.sessionId);

      return sessionRetrievalResultSchema.parse({
        query,
        threads: thread ? [thread] : [],
        turns: thread ? getTurnsForThread(store, query.sessionId, thread.threadKey) : [],
        mentions,
      });
    }
    case "thread_by_key": {
      const thread = query.threadKey
        ? getThreadByKey(store, query.sessionId, query.threadKey)
        : null;

      return sessionRetrievalResultSchema.parse({
        query,
        threads: thread ? [thread] : [],
        turns:
          thread && query.threadKey
            ? getTurnsForThread(store, query.sessionId, query.threadKey)
            : [],
        mentions,
      });
    }
    case "reactivation_candidates":
      return sessionRetrievalResultSchema.parse({
        query,
        threads: getReactivationCandidates(store, query.sessionId),
        turns: [],
        mentions,
      });
    case "turns_for_thread":
      return sessionRetrievalResultSchema.parse({
        query,
        threads:
          query.threadKey
            ? [getThreadByKey(store, query.sessionId, query.threadKey)].filter(Boolean)
            : [],
        turns: query.threadKey
          ? getTurnsForThread(store, query.sessionId, query.threadKey)
          : [],
        mentions,
      });
  }
}
