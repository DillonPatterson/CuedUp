import type { CandidateNextMove, ConversationMode } from "@/types";

type NudgeRailProps = {
  uiMode: "live" | "replay";
  sessionId: string;
  currentMode: ConversationMode;
  staleNudgeGuard: boolean;
  candidateNextMoves: CandidateNextMove[];
  liveCue: string | null;
  hasCurrentTurn: boolean;
};

export function NudgeRail({
  uiMode,
  sessionId,
  currentMode,
  staleNudgeGuard,
  candidateNextMoves,
  liveCue,
  hasCurrentTurn,
}: NudgeRailProps) {
  const primaryMove = candidateNextMoves[0] ?? null;

  if (uiMode === "live") {
    return (
      <aside className="panel flex min-h-80 items-center p-6 md:p-8">
        <div className="w-full">
          <p className="text-4xl font-semibold leading-tight tracking-tight text-stone-900 md:text-5xl">
            {liveCue ?? (hasCurrentTurn ? "Hold steady" : "Listen first")}
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel min-h-80 p-6">
      <p className="eyebrow">Next move</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Operator nudge rail
      </h2>
      <p className="mt-2 text-sm text-stone-600">Session {sessionId}</p>

      <div className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-amber-700">
          Current mode
        </p>
        <p className="mt-2 text-3xl font-semibold text-stone-900">
          {currentMode}
        </p>
        {primaryMove ? (
          <>
            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-amber-700">
              Top candidate
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-stone-900">
              {primaryMove.label}
            </h3>
            <p className="mt-3 text-base leading-7 text-stone-700">
              {primaryMove.reason}
            </p>
            {primaryMove.promptFragment ? (
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-base leading-7 text-stone-800">
                {primaryMove.promptFragment}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-4 text-stone-700">
            No candidate next move is available yet.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
          Repetition guard
        </p>
        <p className="mt-2 text-lg font-semibold text-stone-900">
          {staleNudgeGuard ? "Stale move suppressed" : "Fresh move available"}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {candidateNextMoves.slice(1).map((move) => (
          <article
            key={move.id}
            className="rounded-2xl border border-stone-200 bg-white/80 p-4"
          >
            <p className="text-sm font-semibold text-stone-900">{move.label}</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {move.reason}
            </p>
          </article>
        ))}
      </div>
    </aside>
  );
}
