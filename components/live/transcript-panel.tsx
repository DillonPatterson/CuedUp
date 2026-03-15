import type { TranscriptTurn } from "@/types";

type TranscriptPanelProps = {
  sessionId: string;
  guestName: string;
  recentTurns: TranscriptTurn[];
  currentTurn: TranscriptTurn | null;
  currentTurnIndex: number;
  currentSnapshotIndex: number;
  totalTurns: number;
  replaySourceLabel: string;
  checkpointFocusLabel: string | null;
  isAutoplaying: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  onAutoplayToggle: () => void;
};

function speakerLabel(speaker: TranscriptTurn["speaker"]) {
  return speaker.charAt(0).toUpperCase() + speaker.slice(1);
}

export function TranscriptPanel({
  sessionId,
  guestName,
  recentTurns,
  currentTurn,
  currentTurnIndex,
  currentSnapshotIndex,
  totalTurns,
  replaySourceLabel,
  checkpointFocusLabel,
  isAutoplaying,
  onNext,
  onPrevious,
  onReset,
  onAutoplayToggle,
}: TranscriptPanelProps) {
  const isSeedSnapshot = currentSnapshotIndex === 0;

  return (
    <section className="panel min-h-80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Transcript replay</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            {guestName} live monitor
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Session {sessionId} | {replaySourceLabel}
          </p>
          {checkpointFocusLabel ? (
            <p className="mt-2 text-sm text-amber-800">
              Checkpoint focus: {checkpointFocusLabel}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Replay position
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {isSeedSnapshot
              ? "Seed snapshot"
              : `Turn ${Math.max(currentTurnIndex + 1, 0)} / ${totalTurns}`}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Snapshot {currentSnapshotIndex} / {totalTurns}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentTurnIndex < 0}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={currentTurnIndex >= totalTurns - 1}
          className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next turn
        </button>
        <button
          type="button"
          onClick={onAutoplayToggle}
          disabled={totalTurns === 0 || currentTurnIndex >= totalTurns - 1}
          className="rounded-full border border-amber-700 px-4 py-2 text-sm font-medium text-amber-800 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAutoplaying ? "Stop autoplay" : "Start autoplay"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition"
        >
          Reset replay
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-stone-200 bg-stone-950 px-5 py-6 text-stone-50">
        <p className="text-xs uppercase tracking-[0.16em] text-amber-300">
          {isSeedSnapshot ? "Current turn" : `Current turn | ${currentTurnIndex + 1}`}
        </p>
        {currentTurn ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-300">
              <span className="rounded-full bg-stone-800 px-3 py-1">
                {speakerLabel(currentTurn.speaker)}
              </span>
              <span>{currentTurn.timestamp}</span>
              <span>Energy {currentTurn.energyScore.toFixed(2)}</span>
              <span>Specificity {currentTurn.specificityScore.toFixed(2)}</span>
            </div>
            <p className="mt-4 text-2xl leading-9 text-stone-50">
              {currentTurn.text}
            </p>
          </>
        ) : (
          <p className="mt-4 text-lg leading-8 text-stone-200">
            Replay is seeded from the dossier handoff and waiting for the first
            transcript turn.
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Recent turns
        </p>
        <div className="mt-3 space-y-3">
          {recentTurns.length > 0 ? (
            recentTurns.map((turn) => (
              <article
                key={turn.id}
                className={`rounded-2xl border p-4 ${
                  currentTurn?.id === turn.id
                    ? "border-amber-300 bg-amber-50/70"
                    : "border-stone-200 bg-stone-50/70"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-stone-500">
                  <span>{speakerLabel(turn.speaker)}</span>
                  <span>{turn.timestamp}</span>
                  {currentTurn?.id === turn.id ? <span>Current snapshot</span> : null}
                </div>
                <p className="mt-2 text-base leading-7 text-stone-800">
                  {turn.text}
                </p>
              </article>
            ))
          ) : (
            <p className="text-stone-600">
              No transcript turns have been replayed yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
