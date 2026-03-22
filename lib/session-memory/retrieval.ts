import {
  sessionRetrievalResultSchema,
  type CanonicalTurn,
  type SessionMemoryStore,
  type SessionRetrievalQuery,
} from "@/lib/session-memory/contracts";

function buildRetrievalResult(
  query: SessionRetrievalQuery,
  basis: string[],
  threads: SessionMemoryStore["session_threads"],
  turns: CanonicalTurn[],
  mentions: SessionMemoryStore["session_thread_mentions"],
) {
  return sessionRetrievalResultSchema.parse({
    query,
    basis,
    threads,
    turns,
    mentions,
  });
}

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
  // Phase 1 unresolved ranking is intentionally simple and inspectable:
  // debt score first, then drop score as a tiebreaker.
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
  // Reactivation emphasizes what was mentioned and then left behind:
  // drop score first, then debt score as a tiebreaker.
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
      return buildRetrievalResult(
        query,
        ["Returned open threads ranked by debt score, then drop score."],
        getUnresolvedThreads(store, query.sessionId),
        [],
        mentions,
      );
    case "most_dropped_thread": {
      const thread = getMostDroppedThread(store, query.sessionId);

      return buildRetrievalResult(
        query,
        [
          "Selected the highest-ranked unresolved thread by drop score.",
          "Returned the exact supporting turns linked to that thread key.",
        ],
        thread ? [thread] : [],
        thread ? getTurnsForThread(store, query.sessionId, thread.threadKey) : [],
        mentions,
      );
    }
    case "thread_by_key": {
      const thread = query.threadKey
        ? getThreadByKey(store, query.sessionId, query.threadKey)
        : null;

      return buildRetrievalResult(
        query,
        ["Performed exact thread-key lookup against the session thread ledger."],
        thread ? [thread] : [],
        thread && query.threadKey
          ? getTurnsForThread(store, query.sessionId, query.threadKey)
          : [],
        mentions,
      );
    }
    case "reactivation_candidates":
      return buildRetrievalResult(
        query,
        [
          "Returned unresolved threads with positive drop score.",
          "Cooling or resolved threads stay out of the reactivation list.",
        ],
        getReactivationCandidates(store, query.sessionId),
        [],
        mentions,
      );
    case "turns_for_thread":
      const requestedThread = query.threadKey
        ? getThreadByKey(store, query.sessionId, query.threadKey)
        : null;

      return buildRetrievalResult(
        query,
        ["Returned the canonical supporting turns for the requested thread key."],
        requestedThread ? [requestedThread] : [],
        query.threadKey
          ? getTurnsForThread(store, query.sessionId, query.threadKey)
          : [],
        mentions,
      );
  }
}
