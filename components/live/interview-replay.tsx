"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NudgeRail } from "@/components/live/nudge-rail";
import { PresenceDecisionLog } from "@/components/live/presence-decision-log";
import { ReplayTranscriptInput } from "@/components/live/replay-transcript-input";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { TranscriptPanel } from "@/components/live/transcript-panel";
import { replayFixtures } from "@/lib/mock/replay-fixtures";
import { buildInterviewSessionTimeline } from "@/lib/state/interview-session-timeline";
import {
  appendManualTranscriptTurn,
  importReplayTranscriptTurnDrafts,
  importReplayTranscriptTurns,
} from "@/lib/transcript/manual-turns";

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
  // Replay owns an ephemeral local copy of turns so manual appends stay dev-only
  // and do not pretend to be canonical persisted session truth.
  const [replayLocalTurns, setReplayLocalTurns] = useState(transcriptTurns);
  const timeline = useMemo(
    () =>
      buildInterviewSessionTimeline(
        engineSessionId,
        handoff,
        replayLocalTurns,
      ),
    [engineSessionId, handoff, replayLocalTurns],
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

  function handleAppendTurn(
    draft: Parameters<typeof appendManualTranscriptTurn>[2],
  ) {
    const nextTurns = appendManualTranscriptTurn(
      replayLocalTurns,
      engineSessionId,
      draft,
    );

    startTransition(() => {
      setReplayLocalTurns(nextTurns);
      // `snapshots[0]` is the seeded pre-turn snapshot and `snapshots[i]`
      // corresponds to `turns[i - 1]`, so `nextTurns.length` lands on the
      // snapshot produced by the just-appended turn.
      // The timeline builder emits one initial seeded snapshot plus one snapshot
      // per turn, so the latest turn always lives at snapshot index `turns.length`.
      setCurrentSnapshotIndex(nextTurns.length);
      setIsAutoplaying(false);
    });
  }

  function handleImportTranscript(rawTranscript: string) {
    const nextTurns = importReplayTranscriptTurns(
      replayLocalTurns,
      engineSessionId,
      rawTranscript,
    );

    startTransition(() => {
      setReplayLocalTurns(nextTurns);
      setCurrentSnapshotIndex(nextTurns.length);
      setIsAutoplaying(false);
    });
  }

  function handleLoadFixture(fixtureId: string) {
    const fixture = replayFixtures.find((item) => item.id === fixtureId);

    if (!fixture) {
      return;
    }

    const nextTurns = importReplayTranscriptTurnDrafts(
      [],
      engineSessionId,
      fixture.transcript,
    );

    startTransition(() => {
      setReplayLocalTurns(nextTurns);
      // `snapshots[0]` is the seeded pre-turn snapshot and `snapshots[i]`
      // corresponds to `turns[i - 1]`, so `nextTurns.length` lands on the
      // snapshot produced by the last loaded fixture turn.
      setCurrentSnapshotIndex(nextTurns.length);
      setIsAutoplaying(false);
    });
  }

  function handleResetToSeededSession() {
    startTransition(() => {
      setReplayLocalTurns(transcriptTurns);
      // Reset-to-seeded intentionally goes back to the empty pre-turn snapshot,
      // unlike fixture loads, so replay starts again from the canonical seed.
      setCurrentSnapshotIndex(INITIAL_SNAPSHOT_INDEX);
      setIsAutoplaying(false);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
      <TranscriptPanel
        sessionId={displaySessionId}
        guestName={guestName}
        recentTurns={currentSnapshot.recentTurns}
        currentTurn={currentSnapshot.currentTurn}
        currentTurnIndex={currentTurnIndex}
        totalTurns={replayLocalTurns.length}
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
      <ReplayTranscriptInput
        fixtures={replayFixtures}
        onAppend={handleAppendTurn}
        onImport={handleImportTranscript}
        onLoadFixture={handleLoadFixture}
        onResetToSeededSession={handleResetToSeededSession}
      />
    </div>
  );
}
