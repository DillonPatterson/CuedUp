"use client";

import type { ReplayCommittedTurnMetadata } from "@/lib/transcript/manual-turns";
import type { InterviewSessionSnapshot } from "@/lib/state/interview-session-timeline";

type ReplayCurrentTurnProps = {
  snapshot: InterviewSessionSnapshot;
  currentTurnIndex: number;
  totalTurns: number;
  replaySourceLabel: string;
  turnMetadata: Record<string, ReplayCommittedTurnMetadata>;
  isAutoplaying: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  onAutoplayToggle: () => void;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function speakerLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ReplayCurrentTurn({
  snapshot,
  currentTurnIndex,
  totalTurns,
  replaySourceLabel,
  turnMetadata,
  isAutoplaying,
  onNext,
  onPrevious,
  onReset,
  onAutoplayToggle,
}: ReplayCurrentTurnProps) {
  const currentTurn = snapshot.currentTurn;
  const metadata = currentTurn ? turnMetadata[currentTurn.id] ?? null : null;
  const positionLabel =
    currentTurnIndex < 0
      ? "Seed snapshot"
      : `Turn ${currentTurnIndex + 1} / ${totalTurns}`;
  const visibleLexicalHits =
    metadata?.analysis.affective.triggerTerms
      .filter((hit) => hit.tier !== "intensifier")
      .slice(0, 4) ?? [];

  return (
    <section id="conversation-workspace" className="panel p-5">
      <div className="rounded-3xl border border-stone-800 bg-stone-950 px-5 py-6 text-stone-50">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-300">
          <span>{positionLabel}</span>
          <span>Replay {replaySourceLabel}</span>
          {isAutoplaying ? (
            <span className="rounded-full bg-amber-700 px-3 py-1 text-white">
              Autoplaying
            </span>
          ) : null}
        </div>

        <div id="workspace-transcript-rail" className="mt-4">
          {currentTurn ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
                <span className="rounded-full bg-stone-800 px-3 py-1">
                  {speakerLabel(currentTurn.speaker)}
                </span>
                <span>{currentTurn.timestamp}</span>
                <span>{metadata?.label ?? "Committed transcript"}</span>
              </div>
              <p className="mt-4 text-2xl leading-9 text-stone-50">
                {currentTurn.text}
              </p>
            </>
          ) : (
            <p className="text-lg leading-8 text-stone-300">
              Waiting for a committed turn before replay can show analyzer output.
            </p>
          )}
        </div>

        {metadata ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-300">
              <span className="rounded-full bg-stone-800 px-3 py-1">
                {formatLabel(metadata.analysis.turnKind)}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Specificity {metadata.analysis.specificityBand}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Signal {formatLabel(metadata.analysis.emotionalSignal)}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Cue {metadata.analysis.cuePotential}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Completion {formatLabel(metadata.analysis.completion.completionStatus)}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Affect {metadata.analysis.affective.intensity}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Emotion {formatLabel(metadata.analysis.affective.dominantEmotion)}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Thread {formatLabel(metadata.analysis.threadAction)}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Salience {metadata.memory.salience}
              </span>
              {metadata.analysis.interruption.interruptedPreviousTurn ? (
                <span className="rounded-full bg-amber-700 px-3 py-1 text-white">
                  Interrupted
                </span>
              ) : null}
            </div>

            {visibleLexicalHits.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-300">
                {visibleLexicalHits.map((hit) => (
                  <span
                    key={`${hit.source}:${hit.tier}:${hit.term}`}
                    className="rounded-full bg-stone-800 px-3 py-1"
                  >
                    {hit.term} | {formatLabel(hit.tier)}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition disabled:cursor-not-allowed disabled:opacity-40"
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
    </section>
  );
}
