"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { AudioCuePlayer } from "@/components/live/audio-cue-player";
import { NudgeRail } from "@/components/live/nudge-rail";
import { NextNudgeCandidatePanel } from "@/components/live/next-nudge-candidate-panel";
import { PresenceDecisionLog } from "@/components/live/presence-decision-log";
import { ReplayCurrentTurn } from "@/components/live/replay-current-turn";
import { ReplayListeningSandbox } from "@/components/live/replay-listening-sandbox";
import { ReplayUpdatesPanel } from "@/components/live/replay-updates-panel";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { buildAudioCueEvent } from "@/lib/live/audio-cue-engine";
import { buildFreshReplayHandoff } from "@/lib/replay/fresh-workspace";
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
  initialIsFreshInterview?: boolean;
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
      isFreshInterview?: unknown;
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
      isFreshInterview: parsed.isFreshInterview === true,
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

function buildNewInterviewSource(): ReplaySourceState {
  return {
    label: "New interview workspace",
    detail:
      "Fresh replay-local workspace. Live sorting preview updates as the sandbox draft changes, and committed turns append into an empty transcript stream.",
  };
}

export function InterviewReplay({
  displaySessionId,
  engineSessionId,
  guestName,
  handoff,
  transcriptTurns,
  initialIsFreshInterview = false,
}: InterviewReplayProps) {
  void guestName;
  const searchParams = useSearchParams();
  const newInterviewRequestHandledRef = useRef<string | null>(null);
  // Replay owns an ephemeral local copy of turns so manual appends stay dev-only
  // and do not pretend to be canonical persisted session truth.
  const [replayLocalTurns, setReplayLocalTurns] = useState(transcriptTurns);
  const [replayTurnMetadata, setReplayTurnMetadata] = useState<
    Record<string, ReplayCommittedTurnMetadata>
  >({});
  const [isFreshInterview, setIsFreshInterview] = useState(initialIsFreshInterview);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(INITIAL_SNAPSHOT_INDEX);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [replaySource, setReplaySource] = useState<ReplaySourceState>(
    () =>
      initialIsFreshInterview
        ? buildNewInterviewSource()
        : buildSeededReplaySource(),
  );
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const [showEngineDetail, setShowEngineDetail] = useState(false);
  const [audioPlayRequest, setAudioPlayRequest] = useState(0);
  const activeHandoff = useMemo(
    () => (isFreshInterview ? buildFreshReplayHandoff() : handoff),
    [handoff, isFreshInterview],
  );
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
        activeHandoff,
        replayLocalTurns,
      ),
    [activeHandoff, engineSessionId, replayLocalTurns],
  );
  const transcriptOrganization = useMemo(
    () =>
      buildReplayTranscriptOrganization(
        visibleReplayTurns,
        visibleReplayTurnMetadata,
        { handoff: activeHandoff },
      ),
    [activeHandoff, visibleReplayTurnMetadata, visibleReplayTurns],
  );
  const currentSnapshot = timeline.snapshots[currentSnapshotIndex];
  const currentTurnIndex = currentSnapshotIndex - 1;
  const audioCue = useMemo(
    () => buildAudioCueEvent(transcriptOrganization.nextNudge),
    [transcriptOrganization.nextNudge],
  );
  const recentDecisions = timeline.decisionLog
    .slice(Math.max(0, currentSnapshotIndex - 5), currentSnapshotIndex)
    .reverse();

  useEffect(() => {
    if (searchParams.get("newInterview") === "1") {
      return;
    }

    const storedReplaySession = readStoredReplaySession(engineSessionId);

    if (!storedReplaySession) {
      return;
    }

    startTransition(() => {
      setReplayLocalTurns(storedReplaySession.turns);
      setReplayTurnMetadata(storedReplaySession.turnMetadata);
      setIsFreshInterview(storedReplaySession.isFreshInterview);
      setCurrentSnapshotIndex(storedReplaySession.currentSnapshotIndex);
      setReplaySource(storedReplaySession.replaySource);
      setRestoreNotice(
        "Restored browser-local replay session. Review source and snapshot position before continuing.",
      );
    });
  }, [engineSessionId, searchParams]);

  useEffect(() => {
    const shouldStartNewInterview = searchParams.get("newInterview") === "1";
    const startupKey = `${engineSessionId}:${shouldStartNewInterview}`;

    if (
      !shouldStartNewInterview ||
      newInterviewRequestHandledRef.current === startupKey
    ) {
      return;
    }

    newInterviewRequestHandledRef.current = startupKey;

    try {
      window.localStorage.removeItem(replaySessionStorageKey(engineSessionId));
    } catch {
      // Browser-local replay persistence is best-effort only.
    }

    startTransition(() => {
      setReplayLocalTurns([]);
      setReplayTurnMetadata({});
      setIsFreshInterview(true);
      setCurrentSnapshotIndex(INITIAL_SNAPSHOT_INDEX);
      setIsAutoplaying(false);
      setReplaySource(buildNewInterviewSource());
      setRestoreNotice(null);
      setIsUpdatesOpen(false);
      setShowEngineDetail(false);
    });

    const nextUrl = `${window.location.pathname}${window.location.hash || "#listening-sandbox"}`;
    window.history.replaceState({}, "", nextUrl);
  }, [engineSessionId, searchParams]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        replaySessionStorageKey(engineSessionId),
        JSON.stringify({
          turns: replayLocalTurns,
          turnMetadata: replayTurnMetadata,
          isFreshInterview,
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
    isFreshInterview,
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
    startTransition(() => {
      setIsFreshInterview(false);
    });
  }

  function handleResetToFreshInterview() {
    applyReplayLocalTurns(
      [],
      INITIAL_SNAPSHOT_INDEX,
      buildNewInterviewSource(),
      {},
    );
    startTransition(() => {
      setIsFreshInterview(true);
    });
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
      setShowEngineDetail(false);
    });
    if (isFreshInterview) {
      handleResetToFreshInterview();
      return;
    }

    handleResetToSeededSession();
  }

  function handleStartNewInterview() {
    if (typeof window === "undefined") {
      return;
    }

    window.location.assign(
      `/interview/${displaySessionId}/replay?newInterview=1&autostartListening=1#listening-sandbox`,
    );
  }

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
              onClick={handleStartNewInterview}
              className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
            >
              New interview
            </button>
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

      <AudioCuePlayer cue={audioCue} playRequest={audioPlayRequest} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-start">
        <ReplayListeningSandbox
          engineSessionId={engineSessionId}
          replaySourceLabel={replaySource.label}
          lastCommittedTurn={replayLocalTurns.at(-1) ?? null}
          onCommitDrafts={(drafts) => handleAppendDrafts(drafts, "sandbox commit")}
        />

        <div className="space-y-6 xl:sticky xl:top-6">
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

          <NextNudgeCandidatePanel
            selection={transcriptOrganization.nextNudge}
            footer={
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                      Replay audio cue
                    </p>
                    <p className="mt-2 text-lg font-semibold text-stone-900">
                      {audioCue?.text ?? "No audio cue ready"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudioPlayRequest((value) => value + 1)}
                    disabled={!audioCue}
                    className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Preview audio cue
                  </button>
                </div>
                {audioCue ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-600">
                    <span className="rounded-full bg-stone-100 px-3 py-1">
                      {audioCue.validation.wordCount} / {audioCue.validation.maxWordCount} words
                    </span>
                    <span className="rounded-full bg-stone-100 px-3 py-1">
                      {audioCue.validation.bannedTerms.length === 0
                        ? "No banned terms"
                        : `Banned ${audioCue.validation.bannedTerms.join(", ")}`}
                    </span>
                    <span className="rounded-full bg-stone-100 px-3 py-1">
                      {audioCue.validation.hasQuestionMark
                        ? "Has question mark"
                        : "No question mark"}
                    </span>
                    <span className="rounded-full bg-stone-100 px-3 py-1">
                      {audioCue.validation.isEmpty
                        ? "Empty cue"
                        : audioCue.validation.isAwkwardlyLong
                          ? "Too long"
                          : "Length okay"}
                    </span>
                  </div>
                ) : null}
              </div>
            }
          />
        </div>
      </div>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-3xl">
            <p className="eyebrow">Engine detail</p>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              Keep the listening and sorting workspace in view by default. Open the
              deeper thread, nudge, guard, and topic panels only when you need them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEngineDetail((value) => !value)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            {showEngineDetail ? "Hide engine detail" : "Show engine detail"}
          </button>
        </div>

        {showEngineDetail ? (
          <div className="mt-5 space-y-6">
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

            <TopicMap
              sessionId={displaySessionId}
              coveredVeins={currentSnapshot.conversationState.coveredVeins}
              storyVeinProgress={currentSnapshot.storyVeinProgress}
              emotionalHeat={currentSnapshot.conversationState.emotionalHeat}
              closureConfidence={currentSnapshot.conversationState.closureConfidence}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Unresolved threads
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">
                {currentSnapshot.unresolvedThreads.length}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Surfaced cue
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-stone-900">
                {currentSnapshot.surfaceCue?.text ?? "No cue surfaced"}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Guard outcome
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-stone-900">
                {currentSnapshot.decisionLogEntry.formattedCue ??
                  currentSnapshot.decisionLogEntry.candidateLabel ??
                  currentSnapshot.decisionLogEntry.outcome}
              </p>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
