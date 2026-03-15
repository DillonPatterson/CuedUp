"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NudgeRail } from "@/components/live/nudge-rail";
import { PresenceDecisionLog } from "@/components/live/presence-decision-log";
import { ReplayListeningSandbox } from "@/components/live/replay-listening-sandbox";
import { ReplayProofSummary } from "@/components/live/replay-proof-summary";
import { ReplayTranscriptInput } from "@/components/live/replay-transcript-input";
import { ReplayValidationGuide } from "@/components/live/replay-validation-guide";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { TranscriptPanel } from "@/components/live/transcript-panel";
import {
  getReplayFixtureDefinition,
  replayFixtures,
  type ReplayFixtureDefinition,
} from "@/lib/mock/replay-fixtures";
import { transcriptTurnSchema } from "@/lib/schemas/transcript";
import { buildInterviewSessionTimeline } from "@/lib/state/interview-session-timeline";
import {
  appendManualTranscriptTurn,
  importReplayTranscriptTurnDrafts,
  importReplayTranscriptTurns,
} from "@/lib/transcript/manual-turns";
import {
  buildInitialProofSession,
  buildProofCompactSummary,
  buildProofJsonSummary,
  buildProofMarkdownSummary,
  hydrateProofSession,
  setActiveProofFixture,
  summarizeProofSession,
  updateCheckpointReview,
  updateFixtureAssessment,
  type ReplayCheckpointStatus,
  type ReplayFixtureAssessment,
} from "@/lib/replay/proof-session";

type InterviewReplayProps = {
  displaySessionId: string;
  engineSessionId: string;
  guestName: string;
  handoff: DossierLiveHandoff;
  transcriptTurns: TranscriptTurn[];
};

const INITIAL_SNAPSHOT_INDEX = 0;
const AUTOPLAY_INTERVAL_MS = 1800;
const proofSessionStorageKey = (engineSessionId: string) =>
  `cuedup:replay-proof-session:${engineSessionId}`;
const replaySessionStorageKey = (engineSessionId: string) =>
  `cuedup:replay-session:${engineSessionId}`;

type ReplayAppendSource = "manual turn" | "JSON import" | "sandbox commit";

type ReplaySourceState = {
  label: string;
  detail: string;
  activeFixtureId: string | null;
  isFixtureRunModified: boolean;
};

function isReplaySourceState(value: unknown): value is ReplaySourceState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ReplaySourceState>;

  return (
    typeof candidate.label === "string" &&
    typeof candidate.detail === "string" &&
    (typeof candidate.activeFixtureId === "string" ||
      candidate.activeFixtureId === null) &&
    typeof candidate.isFixtureRunModified === "boolean"
  );
}

function readStoredReplaySession(engineSessionId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      replaySessionStorageKey(engineSessionId),
    );

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      turns?: unknown;
      currentSnapshotIndex?: unknown;
      replaySource?: unknown;
      selectedCheckpointId?: unknown;
    };
    const parsedTurns = transcriptTurnSchema.array().safeParse(parsed.turns);

    if (!parsedTurns.success || !isReplaySourceState(parsed.replaySource)) {
      return null;
    }

    const maxSnapshotIndex = parsedTurns.data.length;
    const storedSnapshotIndex =
      typeof parsed.currentSnapshotIndex === "number"
        ? Math.min(Math.max(parsed.currentSnapshotIndex, 0), maxSnapshotIndex)
        : INITIAL_SNAPSHOT_INDEX;

    return {
      turns: parsedTurns.data,
      currentSnapshotIndex: storedSnapshotIndex,
      replaySource: parsed.replaySource,
      selectedCheckpointId:
        typeof parsed.selectedCheckpointId === "string"
          ? parsed.selectedCheckpointId
          : null,
    };
  } catch {
    return null;
  }
}

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
  const [proofSession, setProofSession] = useState(() =>
    buildInitialProofSession(replayFixtures),
  );
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
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
  const proofSummary = useMemo(
    () => summarizeProofSession(replayFixtures, proofSession),
    [proofSession],
  );
  const markdownProofSummary = useMemo(
    () => buildProofMarkdownSummary(replayFixtures, proofSession),
    [proofSession],
  );
  const compactProofSummary = useMemo(
    () => buildProofCompactSummary(replayFixtures, proofSession),
    [proofSession],
  );
  const jsonProofSummary = useMemo(
    () => buildProofJsonSummary(replayFixtures, proofSession),
    [proofSession],
  );
  const activeFixtureSummary = activeFixture
    ? proofSummary.fixtures.find((fixture) => fixture.fixtureId === activeFixture.id) ?? null
    : null;
  const currentAssessment = activeFixtureSummary?.assessment ?? null;
  const checkpointReviews = activeFixture
    ? (proofSession.fixtures[activeFixture.id]?.checkpointReviews ?? {})
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
  const nextPendingCheckpoint =
    activeFixture?.checkpoints.find(
      (checkpoint) =>
        (checkpointReviews[checkpoint.id]?.status ?? "pending") === "pending",
    ) ?? null;

  useEffect(() => {
    const storedReplaySession = readStoredReplaySession(engineSessionId);

    if (!storedReplaySession) {
      return;
    }

    startTransition(() => {
      setReplayLocalTurns(storedReplaySession.turns);
      setCurrentSnapshotIndex(storedReplaySession.currentSnapshotIndex);
      setReplaySource(storedReplaySession.replaySource);
      setSelectedCheckpointId(storedReplaySession.selectedCheckpointId);
      setRestoreNotice(
        "Restored browser-local replay session. Review source, checkpoint focus, and snapshot position before continuing.",
      );
      setProofSession((currentSession) =>
        setActiveProofFixture(
          currentSession,
          storedReplaySession.replaySource.activeFixtureId,
        ),
      );
    });
  }, [engineSessionId]);

  useEffect(() => {
    try {
      const storedProofSession = window.localStorage.getItem(
        proofSessionStorageKey(engineSessionId),
      );

      if (!storedProofSession) {
        return;
      }

      startTransition(() => {
        setProofSession(hydrateProofSession(replayFixtures, storedProofSession));
        setRestoreNotice((currentNotice) =>
          currentNotice
            ? `${currentNotice} Proof session state was restored too.`
            : "Restored browser-local proof session state.",
        );
      });
    } catch {
      // Browser-local proof persistence is best-effort only.
    }
  }, [engineSessionId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        replaySessionStorageKey(engineSessionId),
        JSON.stringify({
          turns: replayLocalTurns,
          currentSnapshotIndex,
          replaySource,
          selectedCheckpointId,
        }),
      );
    } catch {
      // Browser-local replay persistence is best-effort only.
    }
  }, [
    currentSnapshotIndex,
    engineSessionId,
    replayLocalTurns,
    replaySource,
    selectedCheckpointId,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        proofSessionStorageKey(engineSessionId),
        JSON.stringify(proofSession),
      );
    } catch {
      // Browser-local proof persistence is best-effort only.
    }
  }, [engineSessionId, proofSession]);

  function buildFixtureReplaySource(fixture: ReplayFixtureDefinition): ReplaySourceState {
    return {
      label: `Fixture: ${fixture.label}`,
      detail:
        "Loaded fixture transcript. Replay-local turns were replaced, autoplay stopped, and the view jumped to the latest loaded snapshot.",
      activeFixtureId: fixture.id,
      isFixtureRunModified: false,
    };
  }

  function buildReplaySourceAfterAppend(kind: ReplayAppendSource) {
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
        setProofSession((currentSession) =>
          setActiveProofFixture(
            currentSession,
            nextReplaySource.activeFixtureId,
          ),
        );
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
    handleAppendDrafts([draft], "manual turn");
  }

  function handleAppendDrafts(
    drafts: Parameters<typeof appendManualTranscriptTurn>[2][],
    source: ReplayAppendSource,
  ) {
    const nextTurns = drafts.reduce(
      (currentTurns, draft) =>
        appendManualTranscriptTurn(currentTurns, engineSessionId, draft),
      replayLocalTurns,
    );

    applyReplayLocalTurns(
      nextTurns,
      nextTurns.length,
      buildReplaySourceAfterAppend(source),
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

    setProofSession((currentSession) =>
      updateFixtureAssessment(currentSession, activeFixture.id, assessment),
    );
  }

  function handleCheckpointStatusChange(
    checkpointId: string,
    status: ReplayCheckpointStatus,
  ) {
    if (!activeFixture) {
      return;
    }

    setProofSession((currentSession) =>
      updateCheckpointReview(currentSession, activeFixture.id, checkpointId, {
        status,
      }),
    );
    setSelectedCheckpointId(checkpointId);
  }

  function handleCheckpointNoteChange(checkpointId: string, note: string) {
    if (!activeFixture) {
      return;
    }

    setProofSession((currentSession) =>
      updateCheckpointReview(currentSession, activeFixture.id, checkpointId, {
        note,
      }),
    );
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

  function handleClearBrowserLocalReplayState() {
    try {
      window.localStorage.removeItem(replaySessionStorageKey(engineSessionId));
      window.localStorage.removeItem(proofSessionStorageKey(engineSessionId));
    } catch {
      // Browser-local replay persistence is best-effort only.
    }

    startTransition(() => {
      setProofSession(buildInitialProofSession(replayFixtures));
      setRestoreNotice(
        "Cleared browser-local replay and proof state. Use Clear session inside the listening sandbox if you also want to wipe the sandbox draft.",
      );
    });
    handleResetToSeededSession();
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="eyebrow">Replay cockpit</p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-900">
              Debug transcript and proof workflow
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              One replay-local turn stream feeds the deterministic timeline,
              engine, and Presence Guard. Fixtures, JSON import, manual append,
              and sandbox transcript commits all converge here.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearBrowserLocalReplayState}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Wipe replay/proof restore state
          </button>
        </div>

        {restoreNotice ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {restoreNotice}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Replay source
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {replaySource.label}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Active fixture
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {activeFixture?.label ?? "none"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Checkpoint focus
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {checkpointFocusLabel ?? "none"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Next pending checkpoint
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {nextPendingCheckpoint?.label ?? "none"}
            </p>
          </article>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <ReplayListeningSandbox
            engineSessionId={engineSessionId}
            replaySourceLabel={replaySource.label}
            onCommitDrafts={(drafts) => handleAppendDrafts(drafts, "sandbox commit")}
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

        <div className="space-y-6">
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
            fixtureReviewStatus={activeFixtureSummary?.reviewStatus ?? null}
            checkpointReviews={checkpointReviews}
            selectedCheckpointId={selectedCheckpointId}
            onCheckpointStatusChange={handleCheckpointStatusChange}
            onCheckpointNoteChange={handleCheckpointNoteChange}
            onCheckpointJump={handleCheckpointJump}
          />
          <ReplayProofSummary
            summary={proofSummary}
            compactSummary={compactProofSummary}
            markdownSummary={markdownProofSummary}
            jsonSummary={jsonProofSummary}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <PresenceDecisionLog
          currentDecision={currentSnapshot.decisionLogEntry}
          guardDecisions={currentSnapshot.guardDecisions}
          recentDecisions={recentDecisions}
        />
        <TopicMap
          sessionId={displaySessionId}
          coveredVeins={currentSnapshot.conversationState.coveredVeins}
          storyVeinProgress={currentSnapshot.storyVeinProgress}
          emotionalHeat={currentSnapshot.conversationState.emotionalHeat}
          closureConfidence={currentSnapshot.conversationState.closureConfidence}
        />
      </div>
    </div>
  );
}
