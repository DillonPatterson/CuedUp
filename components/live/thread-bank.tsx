import type { ConversationThread } from "@/types";

type ThreadBankProps = {
  sessionId: string;
  unresolvedThreads: ConversationThread[];
  turnCount: number;
};

export function ThreadBank({
  sessionId,
  unresolvedThreads,
  turnCount,
}: ThreadBankProps) {
  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Thread bank</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            Unresolved threads
          </h2>
          <p className="mt-2 text-sm text-stone-600">Session {sessionId}</p>
        </div>
        <div className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
          {unresolvedThreads.length} open after {turnCount} turns
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {unresolvedThreads.length > 0 ? (
          unresolvedThreads.map((thread) => (
            <article
              key={thread.id}
              className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-stone-900">
                  {thread.label}
                </h3>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs uppercase tracking-[0.14em] text-stone-600">
                  {thread.source.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs uppercase tracking-[0.14em] text-stone-600">
                  {thread.status}
                </span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-stone-200">
                <div
                  className="h-2 rounded-full bg-amber-700"
                  style={{ width: `${Math.round(thread.saturation * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-stone-600">
                <span>Saturation {thread.saturation.toFixed(2)}</span>
                <span>Touches {thread.touchCount}</span>
                <span>Last speaker {thread.lastSpeaker ?? "none"}</span>
              </div>
            </article>
          ))
        ) : (
          <p className="text-stone-600">
            No unresolved threads remain in the current replay state.
          </p>
        )}
      </div>
    </section>
  );
}
