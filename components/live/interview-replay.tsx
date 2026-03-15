"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NudgeRail } from "@/components/live/nudge-rail";
import { PresenceDecisionLog } from "@/components/live/presence-decision-log";
import { ReplayCurrentTurn } from "@/components/live/replay-current-turn";
import { ReplayListeningSandbox } from "@/components/live/replay-listening-sandbox";
import { ReplayUpdatesPanel } from "@/components/live/replay-updates-panel";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { transcriptTurnSchema } from "@/lib/schemas/transcript";
import { buildInterviewSessionTimeline } from "@/lib/state/interview-session-timeline";
import {
  appendReplayTranscriptTurns,
  importReplayTranscriptTurns,
  parseReplayCommittedTurnMetadataRecord,
  type ReplayTranscriptTurnDraft,
  type ReplayCommittedTurnMetadata,
} from "@/lib/transcript/manual-turns";
import { buildReplayTranscriptOrganization } from "@/lib/transcript/organization/build-session-organization";

type InterviewReplayProps = {
  displaySessionId: string;
  engineSessionId: string;
  guestName: string;
  handoff: DossierLiveHandoff;
  transcriptTurns: TranscriptTurn[];
};

const INITIAL_SNAPSHOT_INDEX = 0;
const AUTOPLAY_INTERVAL_MS = 1800;
const replaySessionStorageKey = (engineSessionId: string) =>
  `cuedup:replay-session:${engineSessionId}`;

type ReplayAppendSource = "manual turn" | "JSON import" | "sandbox commit";

type ReplaySourceState = {
  label: string;
  detail: string;
};

function isReplaySourceState(value: unknown): value is ReplaySourceState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ReplaySourceState>;

  return (
    typeof candidate.label === "string" &&
    typeof candidate.detail === "string"
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
      turnMetadata?: unknown;
      turnSources?: unknown;
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
      turnMetadata: parseReplayCommittedTurnMetadataRecord(
        typeof parsed.turnMetadata !== "undefined"
          ? parsed.turnMetadata
          : parsed.turnSources,
      ),
    };
  } catch {
    return null;
  }
}

function buildSeededReplaySource(): ReplaySourceState {
  return {
    label: "Empty replay session",
    detail:
      "Replay starts empty. Use the listening sandbox, manual transcript input, or JSON import to feed real speech into the current replay-local turn stream.",
  };
}

export function InterviewReplay({
  displaySessionId,
  engineSessionId,
  guestName,
  handoff,
  transcriptTurns,
}: InterviewReplayProps) {
  void guestName;
  // Replay owns an ephemeral local copy of turns so manual appends stay dev-only
  // and do not pretend to be canonical persisted session truth.
  const [replayLocalTurns, setReplayLocalTurns] = useState(transcriptTurns);
  const [replayTurnMetadata, setReplayTurnMetadata] = useState<
    Record<string, ReplayCommittedTurnMetadata>
  >({});
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(INITIAL_SNAPSHOT_INDEX);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [replaySource, setReplaySource] = useState<ReplaySourceState>(
    buildSeededReplaySource,
  );
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const visibleReplayTurns = useMemo(
    () => replayLocalTurns.slice(0, currentSnapshotIndex),
    [currentSnapshotIndex, replayLocalTurns],
  );
  const visibleReplayTurnMetadata = useMemo(
    () =>
      visibleReplayTurns.reduce<Record<string, ReplayCommittedTurnMetadata>>(
        (result, turn) => {
          const metadata = replayTurnMetadata[turn.id];

          if (metadata) {
            result[turn.id] = metadata;
          }

          return result;
        },
        {},
      ),
    [replayTurnMetadata, visibleReplayTurns],
  );
  const timeline = useMemo(
    () =>
      buildInterviewSessionTimeline(
        engineSessionId,
        handoff,
        replayLocalTurns,
      ),
    [engineSessionId, handoff, replayLocalTurns],
  );
  const transcriptOrganization = useMemo(
    () =>
      buildReplayTranscriptOrganization(
        visibleReplayTurns,
        visibleReplayTurnMetadata,
        { handoff },
      ),
    [handoff, visibleReplayTurnMetadata, visibleReplayTurns],
  );
  const currentSnapshot = timeline.snapshots[currentSnapshotIndex];
  const currentTurnIndex = currentSnapshotIndex - 1;
  const recentDecisions = timeline.decisionLog
    .slice(Math.max(0, currentSnapshotIndex - 5), currentSnapshotIndex)
    .reverse();

  useEffect(() => {
    const storedReplaySession = readStoredReplaySession(engineSessionId);

    if (!storedReplaySession) {
      return;
    }

    startTransition(() => {
      setReplayLocalTurns(storedReplaySession.turns);
      setReplayTurnMetadata(storedReplaySession.turnMetadata);
      setCurrentSnapshotIndex(storedReplaySession.currentSnapshotIndex);
      setReplaySource(storedReplaySession.replaySource);
      setRestoreNotice(
        "Restored browser-local replay session. Review source and snapshot position before continuing.",
      );
    });
  }, [engineSessionId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        replaySessionStorageKey(engineSessionId),
        JSON.stringify({
          turns: replayLocalTurns,
          turnMetadata: replayTurnMetadata,
          currentSnapshotIndex,
          replaySource,
        }),
      );
    } catch {
      // Browser-local replay persistence is best-effort only.
    }
  }, [
    currentSnapshotIndex,
    engineSessionId,
    replayLocalTurns,
    replayTurnMetadata,
    replaySource,
  ]);

  function buildReplaySourceAfterAppend(kind: ReplayAppendSource) {
    return {
      label: "Replay-local transcript",
      detail: `${kind} appended to the current replay-local turn stream.`,
    } satisfies ReplaySourceState;
  }

  function applyReplayLocalTurns(
    nextTurns: TranscriptTurn[],
    nextSnapshotIndex: number,
    nextReplaySource?: ReplaySourceState,
    nextReplayTurnMetadata?: Record<string, ReplayCommittedTurnMetadata>,
  ) {
    startTransition(() => {
      // Replacing replay-local turns intentionally discards prior replay-only
      // manual/import state so the timeline and guard output rebuild from one
      // canonical local stream only.
      setReplayLocalTurns(nextTurns);
      if (nextReplayTurnMetadata) {
        setReplayTurnMetadata(nextReplayTurnMetadata);
      }
      setCurrentSnapshotIndex(nextSnapshotIndex);
      setIsAutoplaying(false);
      if (nextReplaySource) {
        setReplaySource(nextReplaySource);
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
    draft: ReplayTranscriptTurnDraft,
  ) {
    handleAppendDrafts([draft], "manual turn");
  }

  function handleAppendDrafts(
    drafts: ReplayTranscriptTurnDraft[],
    source: ReplayAppendSource,
  ) {
    const appendResult = appendReplayTranscriptTurns(
      replayLocalTurns,
      engineSessionId,
      drafts,
    );

    applyReplayLocalTurns(
      appendResult.turns,
      appendResult.turns.length,
      buildReplaySourceAfterAppend(source),
      {
        ...replayTurnMetadata,
        ...appendResult.metadata,
      },
    );
  }

  function handleImportTranscript(rawTranscript: string) {
    const appendResult = importReplayTranscriptTurns(
      replayLocalTurns,
      engineSessionId,
      rawTranscript,
    );

    applyReplayLocalTurns(
      appendResult.turns,
      appendResult.turns.length,
      buildReplaySourceAfterAppend("JSON import"),
      {
        ...replayTurnMetadata,
        ...appendResult.metadata,
      },
    );
  }

  function handleResetToSeededSession() {
    applyReplayLocalTurns(
      transcriptTurns,
      INITIAL_SNAPSHOT_INDEX,
      buildSeededReplaySource(),
      {},
    );
  }

  function handleClearBrowserLocalReplayState() {
    try {
      window.localStorage.removeItem(replaySessionStorageKey(engineSessionId));
    } catch {
      // Browser-local replay persistence is best-effort only.
    }

    startTransition(() => {
      setRestoreNotice(
        "Cleared browser-local replay state. Use Clear session inside the listening sandbox if you also want to wipe the sandbox draft.",
      );
    });
    handleResetToSeededSession();
  }

  void transcriptOrganization;
  void handleAppendTurn;
  void handleImportTranscript;

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="eyebrow">Replay/debug</p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-900">
              Debug transcript workspace
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              Commit speech, inspect engine output.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsUpdatesOpen((value) => !value)}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
            >
              {isUpdatesOpen ? "Hide updates" : "Updates"}
            </button>
            <button
              type="button"
              onClick={handleClearBrowserLocalReplayState}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
            >
              Wipe replay restore state
            </button>
          </div>
        </div>

        {restoreNotice ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {restoreNotice}
          </div>
        ) : null}
      </section>

      {isUpdatesOpen ? (
        <ReplayUpdatesPanel onClose={() => setIsUpdatesOpen(false)} />
      ) : null}

      <ReplayListeningSandbox
        engineSessionId={engineSessionId}
        replaySourceLabel={replaySource.label}
        onCommitDrafts={(drafts) => handleAppendDrafts(drafts, "sandbox commit")}
      />

      <ReplayCurrentTurn
        snapshot={currentSnapshot}
        currentTurnIndex={currentTurnIndex}
        totalTurns={replayLocalTurns.length}
        replaySourceLabel={replaySource.label}
        turnMetadata={visibleReplayTurnMetadata}
        isAutoplaying={isAutoplaying}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onReset={handleReset}
        onAutoplayToggle={handleAutoplayToggle}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <ThreadBank
          sessionId={displaySessionId}
          unresolvedThreads={currentSnapshot.unresolvedThreads}
          turnCount={currentSnapshot.conversationState.turnCount}
        />
        <NudgeRail
          sessionId={displaySessionId}
          currentMode={currentSnapshot.conversationState.currentMode}
          staleNudgeGuard={currentSnapshot.conversationState.staleNudgeGuard}
          candidateNextMoves={currentSnapshot.topMoves}
          surfacedCue={currentSnapshot.surfaceCue}
          currentDecision={currentSnapshot.decisionLogEntry}
        />
        <PresenceDecisionLog
          currentDecision={currentSnapshot.decisionLogEntry}
          guardDecisions={currentSnapshot.guardDecisions}
          recentDecisions={recentDecisions}
        />
      </div>

      <section className="panel p-6">
        <p className="eyebrow">Recall candidates</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {transcriptOrganization.recallCandidates.length > 0 ? (
            transcriptOrganization.recallCandidates.slice(0, 4).map((candidate) => (
              <article
                key={candidate.id}
                className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-stone-900">
                    {candidate.label}
                  </p>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-900">
                    {candidate.readiness.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-stone-500">
                  {candidate.sourceKind.replaceAll("_", " ")} | {candidate.recency} | debt{" "}
                  {candidate.completionDebtScore}
                </p>
                <p className="mt-2 text-xs leading-5 text-stone-600">
                  {candidate.reason}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">
              No recall candidates are ready yet.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6">
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
