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

export function InterviewReplay({
  displaySessionId,
  engineSessionId,
  guestName,
  handoff,
  transcriptTurns,
}: InterviewReplayProps) {
  const [currentTurnIndex, setCurrentTurnIndex] = useState(INITIAL_TURN_INDEX);
  const [isAutoplaying, setIsAutoplaying] = useState(false);

  const viewModel = buildInterviewReplayViewModel(
    engineSessionId,
    handoff,
    transcriptTurns,
    currentTurnIndex,
  );

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

          if (nextIndex >= transcriptTurns.length - 1) {
            window.setTimeout(() => setIsAutoplaying(false), 0);
          }

          return nextIndex;
        });
      });
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [currentTurnIndex, isAutoplaying, transcriptTurns.length]);

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
      setIsAutoplaying(false);
    });
  }

  function handleAutoplayToggle() {
    setIsAutoplaying((value) => !value);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
      <TranscriptPanel
        sessionId={displaySessionId}
        guestName={guestName}
        recentTurns={viewModel.recentTurns}
        currentTurn={viewModel.currentTurn}
        currentTurnIndex={currentTurnIndex}
        totalTurns={transcriptTurns.length}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onReset={handleReset}
        onAutoplayToggle={handleAutoplayToggle}
        isAutoplaying={isAutoplaying}
      />
      <NudgeRail
        sessionId={displaySessionId}
        currentMode={viewModel.state.currentMode}
        staleNudgeGuard={viewModel.state.staleNudgeGuard}
        candidateNextMoves={viewModel.topMoves}
      />
      <ThreadBank
        sessionId={displaySessionId}
        unresolvedThreads={viewModel.unresolvedThreads}
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
  );
}
