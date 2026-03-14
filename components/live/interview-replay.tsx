"use client";

import { startTransition, useEffect, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NudgeRail } from "@/components/live/nudge-rail";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { TranscriptPanel } from "@/components/live/transcript-panel";
import { buildInterviewReplayViewModel } from "@/lib/state/replay-view-model";

type InterviewReplayProps = {
  displaySessionId: string;
  engineSessionId: string;
  guestName: string;
  handoff: DossierLiveHandoff;
  transcriptTurns: TranscriptTurn[];
};

const INITIAL_TURN_INDEX = -1;
const AUTOPLAY_INTERVAL_MS = 1800;
type InterviewUiMode = "live" | "replay";

export function InterviewReplay({
  displaySessionId,
  engineSessionId,
  guestName,
  handoff,
  transcriptTurns,
}: InterviewReplayProps) {
  const [uiMode, setUiMode] = useState<InterviewUiMode>("live");
  const [currentTurnIndex, setCurrentTurnIndex] = useState(INITIAL_TURN_INDEX);
  const [isReplayAutoplaying, setIsReplayAutoplaying] = useState(false);

  const viewModel = buildInterviewReplayViewModel(
    engineSessionId,
    handoff,
    transcriptTurns,
    currentTurnIndex,
  );
  const isAutoplaying =
    uiMode === "live"
      ? currentTurnIndex < transcriptTurns.length - 1
      : isReplayAutoplaying;

  useEffect(() => {
    if (!isAutoplaying) {
      return undefined;
    }

    if (currentTurnIndex >= transcriptTurns.length - 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        setCurrentTurnIndex((index) => {
          const nextIndex = Math.min(index + 1, transcriptTurns.length - 1);

          if (uiMode === "replay" && nextIndex >= transcriptTurns.length - 1) {
            window.setTimeout(() => setIsReplayAutoplaying(false), 0);
          }

          return nextIndex;
        });
      });
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [currentTurnIndex, isAutoplaying, transcriptTurns.length, uiMode]);

  function handleNext() {
    startTransition(() => {
      setCurrentTurnIndex((index) => Math.min(index + 1, transcriptTurns.length - 1));
    });
  }

  function handlePrevious() {
    startTransition(() => {
      setCurrentTurnIndex((index) => Math.max(index - 1, INITIAL_TURN_INDEX));
    });
  }

  function handleReset() {
    startTransition(() => {
      setCurrentTurnIndex(INITIAL_TURN_INDEX);
      setIsReplayAutoplaying(false);
    });
  }

  function handleAutoplayToggle() {
    setIsReplayAutoplaying((value) => !value);
  }

  function handleModeChange(nextMode: InterviewUiMode) {
    startTransition(() => {
      setUiMode(nextMode);

      if (nextMode === "live") {
        setIsReplayAutoplaying(false);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {uiMode === "live" ? (
          <button
            type="button"
            onClick={() => handleModeChange("replay")}
            className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
          >
            Replay/debug
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              Developer replay
            </span>
            <button
              type="button"
              onClick={() => handleModeChange("live")}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-stone-600 transition hover:border-stone-400 hover:text-stone-800"
            >
              Return to live
            </button>
          </div>
        )}
      </div>

      {uiMode === "live" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
            <TranscriptPanel
              uiMode="live"
              sessionId={displaySessionId}
              guestName={guestName}
              recentTurns={viewModel.recentTurns}
              currentTurn={viewModel.currentTurn}
              previousTurn={viewModel.previousTurn}
              currentTurnIndex={currentTurnIndex}
              totalTurns={transcriptTurns.length}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onReset={handleReset}
              onAutoplayToggle={handleAutoplayToggle}
              isAutoplaying={isAutoplaying}
            />
            <NudgeRail
              uiMode="live"
              sessionId={displaySessionId}
              currentMode={viewModel.state.currentMode}
              staleNudgeGuard={viewModel.state.staleNudgeGuard}
              candidateNextMoves={viewModel.topMoves}
              liveCue={viewModel.liveCue}
              hasCurrentTurn={viewModel.currentTurn !== null}
            />
          </div>
          <ThreadBank
            uiMode="live"
            sessionId={displaySessionId}
            unresolvedThreads={viewModel.unresolvedThreads}
            liveThreads={viewModel.liveThreads}
            turnCount={viewModel.state.turnCount}
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
          <TranscriptPanel
            uiMode="replay"
            sessionId={displaySessionId}
            guestName={guestName}
            recentTurns={viewModel.recentTurns}
            currentTurn={viewModel.currentTurn}
            previousTurn={viewModel.previousTurn}
            currentTurnIndex={currentTurnIndex}
            totalTurns={transcriptTurns.length}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onReset={handleReset}
            onAutoplayToggle={handleAutoplayToggle}
            isAutoplaying={isAutoplaying}
          />
          <NudgeRail
            uiMode="replay"
            sessionId={displaySessionId}
            currentMode={viewModel.state.currentMode}
            staleNudgeGuard={viewModel.state.staleNudgeGuard}
            candidateNextMoves={viewModel.topMoves}
            liveCue={viewModel.liveCue}
            hasCurrentTurn={viewModel.currentTurn !== null}
          />
          <ThreadBank
            uiMode="replay"
            sessionId={displaySessionId}
            unresolvedThreads={viewModel.unresolvedThreads}
            liveThreads={viewModel.liveThreads}
            turnCount={viewModel.state.turnCount}
          />
          <TopicMap
            sessionId={displaySessionId}
            coveredVeins={viewModel.state.coveredVeins}
            storyVeinProgress={viewModel.storyVeinProgress}
            emotionalHeat={viewModel.state.emotionalHeat}
            closureConfidence={viewModel.state.closureConfidence}
          />
        </div>
      )}
    </div>
  );
}
