"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NudgeRail } from "@/components/live/nudge-rail";
import { PresenceDecisionLog } from "@/components/live/presence-decision-log";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { TranscriptPanel } from "@/components/live/transcript-panel";
import { buildInterviewSessionTimeline } from "@/lib/state/interview-session-timeline";

type InterviewReplayProps = {
  displaySessionId: string;
  engineSessionId: string;
  guestName: string;
  handoff: DossierLiveHandoff;
  transcriptTurns: TranscriptTurn[];
};

const INITIAL_SNAPSHOT_INDEX = 0;
const AUTOPLAY_INTERVAL_MS = 1800;

export function InterviewReplay({
  displaySessionId,
  engineSessionId,
  guestName,
  handoff,
  transcriptTurns,
}: InterviewReplayProps) {
  const timeline = useMemo(
    () => buildInterviewSessionTimeline(engineSessionId, handoff, transcriptTurns),
    [engineSessionId, handoff, transcriptTurns],
  );
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(INITIAL_SNAPSHOT_INDEX);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const currentSnapshot = timeline.snapshots[currentSnapshotIndex];
  const currentTurnIndex = currentSnapshotIndex - 1;
  const recentDecisions = timeline.decisionLog
    .slice(Math.max(0, currentSnapshotIndex - 5), currentSnapshotIndex + 1)
    .reverse();

  useEffect(() => {
    if (!isAutoplaying) {
      return undefined;
    }

    if (currentSnapshotIndex >= timeline.snapshots.length - 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        setCurrentSnapshotIndex((index) => {
          const nextIndex = Math.min(index + 1, timeline.snapshots.length - 1);

          if (nextIndex >= timeline.snapshots.length - 1) {
            window.setTimeout(() => setIsAutoplaying(false), 0);
          }

          return nextIndex;
        });
      });
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [currentSnapshotIndex, isAutoplaying, timeline.snapshots.length]);

  function handleNext() {
    startTransition(() => {
      setCurrentSnapshotIndex((index) => Math.min(index + 1, timeline.snapshots.length - 1));
    });
  }

  function handlePrevious() {
    startTransition(() => {
      setCurrentSnapshotIndex((index) => Math.max(index - 1, INITIAL_SNAPSHOT_INDEX));
    });
  }

  function handleReset() {
    startTransition(() => {
      setCurrentSnapshotIndex(INITIAL_SNAPSHOT_INDEX);
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
        recentTurns={currentSnapshot.recentTurns}
        currentTurn={currentSnapshot.currentTurn}
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
        currentMode={currentSnapshot.conversationState.currentMode}
        staleNudgeGuard={currentSnapshot.conversationState.staleNudgeGuard}
        candidateNextMoves={currentSnapshot.topMoves}
      />
      <ThreadBank
        sessionId={displaySessionId}
        unresolvedThreads={currentSnapshot.unresolvedThreads}
        turnCount={currentSnapshot.conversationState.turnCount}
      />
      <TopicMap
        sessionId={displaySessionId}
        coveredVeins={currentSnapshot.conversationState.coveredVeins}
        storyVeinProgress={currentSnapshot.storyVeinProgress}
        emotionalHeat={currentSnapshot.conversationState.emotionalHeat}
        closureConfidence={currentSnapshot.conversationState.closureConfidence}
      />
      <PresenceDecisionLog
        currentDecision={currentSnapshot.decisionLogEntry}
        recentDecisions={recentDecisions}
      />
    </div>
  );
}
