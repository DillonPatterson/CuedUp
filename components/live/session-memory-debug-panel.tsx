"use client";

import {
  getMostDroppedThread,
  getReactivationCandidates,
  getTurnsForThread,
  getUnresolvedThreads,
  runSessionRetrievalQuery,
} from "@/lib/session-memory/build-session-memory-store";
import type { SessionMemoryStore } from "@/lib/session-memory/contracts";

type SessionMemoryDebugPanelProps = {
  store: SessionMemoryStore;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function SessionMemoryDebugPanel({
  store,
}: SessionMemoryDebugPanelProps) {
  const unresolvedThreads = getUnresolvedThreads(store, store.sessionId);
  const mostDroppedThread = getMostDroppedThread(store, store.sessionId);
  const reactivationCandidates = getReactivationCandidates(store, store.sessionId);
  const sampleThreadTurns = mostDroppedThread
    ? getTurnsForThread(store, store.sessionId, mostDroppedThread.threadKey)
    : [];
  const unresolvedQuery = runSessionRetrievalQuery(store, {
    sessionId: store.sessionId,
    mode: "unresolved_threads",
  });

  return (
    <section className="rounded-3xl border border-stone-200 bg-white/85 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Session memory debug
          </p>
          <p className="mt-1 text-sm leading-6 text-stone-700">
            Replay-only proof of transcript event assembly, thread memory storage,
            and retrieval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-600">
          <span className="rounded-full bg-stone-100 px-3 py-1">
            {store.session_events.length} events
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1">
            {store.session_turns.length} turns
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1">
            {store.session_threads.length} threads
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Raw transcript events
          </p>
          <div className="mt-3 space-y-2">
            {store.session_events.length > 0 ? (
              store.session_events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    Seq {event.sequence} {formatLabel(event.eventType)} {formatLabel(event.source)}
                  </p>
                  <p className="mt-1 leading-6">{event.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                No transcript events captured yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Canonical turns
          </p>
          <div className="mt-3 space-y-2">
            {store.session_turns.length > 0 ? (
              store.session_turns.map((turn) => (
                <div
                  key={turn.id}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    Turn {turn.sequence} {turn.speaker ?? "unknown"}
                  </p>
                  <p className="mt-1 leading-6">{turn.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                No canonical turns finalized yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Thread mentions
          </p>
          <div className="mt-3 space-y-2">
            {store.session_thread_mentions.length > 0 ? (
              store.session_thread_mentions.map((mention) => (
                <div
                  key={mention.id}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    {formatLabel(mention.mentionKind)} linked to {mention.turnId}
                  </p>
                  <p className="mt-1 leading-6">{mention.label}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                No thread mentions extracted yet.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Session thread ledger
          </p>
          <div className="mt-3 space-y-2">
            {store.session_threads.length > 0 ? (
              store.session_threads.map((thread) => (
                <div
                  key={thread.threadKey}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    {formatLabel(thread.sourceKind)} {thread.status} debt {thread.debtScore}
                  </p>
                  <p className="mt-1 leading-6">{thread.label}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                No session threads yet.
              </p>
            )}
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Unresolved threads query
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {unresolvedQuery.threads.length} unresolved thread
            {unresolvedQuery.threads.length === 1 ? "" : "s"} returned.
          </p>
          <div className="mt-3 space-y-2">
            {unresolvedThreads.slice(0, 3).map((thread) => (
              <p key={thread.threadKey} className="text-sm leading-6 text-stone-800">
                {thread.label}
              </p>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Most dropped thread
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-800">
            {mostDroppedThread
              ? `${mostDroppedThread.label} (drop ${mostDroppedThread.dropScore})`
              : "No dropped thread yet."}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            Reactivation candidates: {reactivationCandidates.length}
          </p>
        </article>

        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
            Turns for top thread
          </p>
          <div className="mt-3 space-y-2">
            {sampleThreadTurns.length > 0 ? (
              sampleThreadTurns.map((turn) => (
                <p key={turn.id} className="text-sm leading-6 text-stone-800">
                  {turn.text}
                </p>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-600">
                No thread turns ready yet.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
