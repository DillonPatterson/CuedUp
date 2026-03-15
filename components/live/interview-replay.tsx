"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NudgeRail } from "@/components/live/nudge-rail";
import { PresenceDecisionLog } from "@/components/live/presence-decision-log";
import { ReplayTranscriptInput } from "@/components/live/replay-transcript-input";
import {
  type ReplayCheckpointStatus,
  ReplayValidationGuide,
  type ReplayFixtureAssessment,
} from "@/components/live/replay-validation-guide";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { TranscriptPanel } from "@/components/live/transcript-panel";
import {
  getReplayFixtureDefinition,
  replayFixtures,
  type ReplayFixtureDefinition,
} from "@/lib/mock/replay-fixtures";
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

type ReplaySourceState = {
  label: string;
  detail: string;
  activeFixtureId: string | null;
  isFixtureRunModified: boolean;
};

function buildSeededReplaySource(): ReplaySourceState {
  return {
    label: "Seeded mock session",
    detail:
      "Seeded mock transcript restored. Replay is back at the pre-turn baseline for the canonical mock session.",
    activeFixtureId: null,
    isFixtureRunModified: false,
  };
}

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
  const [replaySource, setReplaySource] = useState<ReplaySourceState>(
    buildSeededReplaySource,
  );
  const [fixtureAssessments, setFixtureAssessments] = useState<
    Record<string, ReplayFixtureAssessment>
  >({});
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [fixtureCheckpointStatuses, setFixtureCheckpointStatuses] = useState<
    Record<string, Record<string, ReplayCheckpointStatus>>
  >({});
  const currentSnapshot = timeline.snapshots[currentSnapshotIndex];
  const currentTurnIndex = currentSnapshotIndex - 1;
  const recentDecisions = timeline.decisionLog
    .slice(Math.max(0, currentSnapshotIndex - 5), currentSnapshotIndex)
    .reverse();
  const activeFixture = replaySource.activeFixtureId
    ? getReplayFixtureDefinition(replaySource.activeFixtureId)
    : null;
  const leadThread = currentSnapshot.unresolvedThreads[0] ?? null;
  const topMove = currentSnapshot.topMoves[0] ?? null;
  const currentAssessment = activeFixture
    ? (fixtureAssessments[activeFixture.id] ?? "pending")
    : null;
  const checkpointStatuses = activeFixture
    ? (fixtureCheckpointStatuses[activeFixture.id] ?? {})
    : {};
  const currentCheckpoint =
    activeFixture?.checkpoints.find(
      (checkpoint) =>
        currentSnapshotIndex >= checkpoint.targetStartSnapshotIndex &&
        currentSnapshotIndex <= checkpoint.targetEndSnapshotIndex,
    ) ?? null;
  const selectedCheckpoint =
    activeFixture?.checkpoints.find(
      (checkpoint) => checkpoint.id === selectedCheckpointId,
    ) ?? null;
  const checkpointFocusLabel =
    currentCheckpoint?.label ?? selectedCheckpoint?.label ?? null;

  function buildFixtureReplaySource(fixture: ReplayFixtureDefinition): ReplaySourceState {
    return {
      label: `Fixture: ${fixture.label}`,
      detail:
        "Loaded fixture transcript. Replay-local turns were replaced, autoplay stopped, and the view jumped to the latest loaded snapshot.",
      activeFixtureId: fixture.id,
      isFixtureRunModified: false,
    };
  }

  function buildReplaySourceAfterAppend(kind: "manual turn" | "JSON import") {
    if (activeFixture) {
      return {
        label: `Fixture: ${activeFixture.label} (modified)`,
        detail: `${kind} appended to the loaded fixture run. This remains useful for exploration, but it is no longer a clean fixture proof baseline.`,
        activeFixtureId: activeFixture.id,
        isFixtureRunModified: true,
      } satisfies ReplaySourceState;
    }

    return {
      label: "Replay-local transcript",
      detail: `${kind} appended to the current replay-local turn stream. This is exploratory replay state, not a clean fixture proof run.`,
      activeFixtureId: null,
      isFixtureRunModified: false,
    } satisfies ReplaySourceState;
  }

  function applyReplayLocalTurns(
    nextTurns: TranscriptTurn[],
    nextSnapshotIndex: number,
    nextReplaySource?: ReplaySourceState,
    nextSelectedCheckpointId?: string | null,
  ) {
    startTransition(() => {
      // Replacing replay-local turns intentionally discards prior replay-only
      // fixture/import/manual state so the timeline and guard output rebuild
      // from one canonical local stream only.
      setReplayLocalTurns(nextTurns);
      setCurrentSnapshotIndex(nextSnapshotIndex);
      setIsAutoplaying(false);
      if (nextReplaySource) {
        setReplaySource(nextReplaySource);
      }
      if (typeof nextSelectedCheckpointId !== "undefined") {
        setSelectedCheckpointId(nextSelectedCheckpointId);
      }
    });
  }

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

    // `snapshots[0]` is the seeded pre-turn snapshot and `snapshots[i]`
    // corresponds to `turns[i - 1]`, so `nextTurns.length` lands on the
    // snapshot produced by the just-appended turn.
    // The timeline builder emits one initial seeded snapshot plus one snapshot
    // per turn, so the latest turn always lives at snapshot index `turns.length`.
    applyReplayLocalTurns(
      nextTurns,
      nextTurns.length,
      buildReplaySourceAfterAppend("manual turn"),
    );
  }

  function handleImportTranscript(rawTranscript: string) {
    const nextTurns = importReplayTranscriptTurns(
      replayLocalTurns,
      engineSessionId,
      rawTranscript,
    );

    applyReplayLocalTurns(
      nextTurns,
      nextTurns.length,
      buildReplaySourceAfterAppend("JSON import"),
    );
  }

  function handleLoadFixture(fixtureId: string) {
    const fixture = replayFixtures.find((item) => item.id === fixtureId);

    if (!fixture) {
      throw new Error("Replay fixture was not found.");
    }

    const nextTurns = importReplayTranscriptTurnDrafts(
      [],
      engineSessionId,
      fixture.transcript,
    );

    // Fixture loads intentionally replace the replay-local turn stream rather
    // than append to it, so the view should jump straight to the latest loaded
    // snapshot instead of showing the empty seeded state.
    applyReplayLocalTurns(
      nextTurns,
      nextTurns.length,
      buildFixtureReplaySource(fixture),
      fixture.checkpoints[0]?.id ?? null,
    );
  }

  function handleResetToSeededSession() {
    // Reset-to-seeded intentionally behaves differently from fixture loading:
    // it restores the seeded mock stream and returns replay to the pre-turn start.
    applyReplayLocalTurns(
      transcriptTurns,
      INITIAL_SNAPSHOT_INDEX,
      buildSeededReplaySource(),
      null,
    );
  }

  function handleAssessmentChange(assessment: ReplayFixtureAssessment) {
    if (!activeFixture) {
      return;
    }

    setFixtureAssessments((currentAssessments) => ({
      ...currentAssessments,
      [activeFixture.id]: assessment,
    }));
  }

  function handleCheckpointStatusChange(
    checkpointId: string,
    status: ReplayCheckpointStatus,
  ) {
    if (!activeFixture) {
      return;
    }

    setFixtureCheckpointStatuses((currentStatuses) => ({
      ...currentStatuses,
      [activeFixture.id]: {
        ...(currentStatuses[activeFixture.id] ?? {}),
        [checkpointId]: status,
      },
    }));
    setSelectedCheckpointId(checkpointId);
  }

  function handleCheckpointJump(checkpointId: string) {
    if (!activeFixture) {
      return;
    }

    const checkpoint = activeFixture.checkpoints.find(
      (item) => item.id === checkpointId,
    );

    if (!checkpoint) {
      return;
    }

    startTransition(() => {
      setCurrentSnapshotIndex(checkpoint.targetStartSnapshotIndex);
      setIsAutoplaying(false);
      setSelectedCheckpointId(checkpointId);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
      <ReplayValidationGuide
        activeFixture={activeFixture}
        replaySourceLabel={replaySource.label}
        replaySourceDetail={replaySource.detail}
        currentSnapshotIndex={currentSnapshotIndex}
        totalTurns={replayLocalTurns.length}
        surfacedCue={currentSnapshot.surfaceCue}
        topMove={topMove}
        leadThread={leadThread}
        currentDecision={currentSnapshot.decisionLogEntry}
        assessment={currentAssessment}
        onAssessmentChange={handleAssessmentChange}
        isFixtureRunModified={replaySource.isFixtureRunModified}
        checkpointStatuses={checkpointStatuses}
        selectedCheckpointId={selectedCheckpointId}
        onCheckpointStatusChange={handleCheckpointStatusChange}
        onCheckpointJump={handleCheckpointJump}
      />
      <TranscriptPanel
        sessionId={displaySessionId}
        guestName={guestName}
        recentTurns={currentSnapshot.recentTurns}
        currentTurn={currentSnapshot.currentTurn}
        currentTurnIndex={currentTurnIndex}
        currentSnapshotIndex={currentSnapshotIndex}
        totalTurns={replayLocalTurns.length}
        replaySourceLabel={replaySource.label}
        checkpointFocusLabel={checkpointFocusLabel}
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
        surfacedCue={currentSnapshot.surfaceCue}
        currentDecision={currentSnapshot.decisionLogEntry}
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
        guardDecisions={currentSnapshot.guardDecisions}
        recentDecisions={recentDecisions}
      />
      <ReplayTranscriptInput
        fixtures={replayFixtures}
        activeFixtureId={activeFixture?.id ?? null}
        replaySourceLabel={replaySource.label}
        replaySourceDetail={replaySource.detail}
        onAppend={handleAppendTurn}
        onImport={handleImportTranscript}
        onLoadFixture={handleLoadFixture}
        onResetToSeededSession={handleResetToSeededSession}
      />
    </div>
  );
}
