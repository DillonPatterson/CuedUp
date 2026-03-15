"use client";

import type {
  CandidateNextMove,
  ConversationThread,
  PresenceGuardDecision,
  SurfaceCue,
} from "@/types";
import type {
  ReplayFixtureCheckpoint,
  ReplayFixtureDefinition,
} from "@/lib/mock/replay-fixtures";
import type {
  FixtureReviewStatus,
  ReplayCheckpointReview,
  ReplayCheckpointStatus,
  ReplayFixtureAssessment,
} from "@/lib/replay/proof-session";

type ReplayValidationGuideProps = {
  activeFixture: ReplayFixtureDefinition | null;
  replaySourceLabel: string;
  replaySourceDetail: string;
  currentSnapshotIndex: number;
  totalTurns: number;
  surfacedCue: SurfaceCue | null;
  topMove: CandidateNextMove | null;
  leadThread: ConversationThread | null;
  currentDecision: PresenceGuardDecision;
  assessment: ReplayFixtureAssessment | null;
  onAssessmentChange: (assessment: ReplayFixtureAssessment) => void;
  isFixtureRunModified: boolean;
  fixtureReviewStatus: FixtureReviewStatus | null;
  checkpointReviews: Record<string, ReplayCheckpointReview>;
  selectedCheckpointId: string | null;
  onCheckpointStatusChange: (
    checkpointId: string,
    status: ReplayCheckpointStatus,
  ) => void;
  onCheckpointNoteChange: (checkpointId: string, note: string) => void;
  onCheckpointJump: (checkpointId: string) => void;
};

const assessmentCopy: Record<
  ReplayFixtureAssessment,
  { label: string; tone: string; buttonClass: string }
> = {
  pending: {
    label: "Inspection pending",
    tone: "Still operator-verified. No automated pass/fail exists here.",
    buttonClass: "border-stone-300 text-stone-700 hover:border-stone-400",
  },
  appears_to_pass: {
    label: "Appears to pass",
    tone: "Human judgment only. This is not an automated test result.",
    buttonClass: "border-emerald-300 text-emerald-800 hover:border-emerald-400",
  },
  appears_to_fail: {
    label: "Appears to fail",
    tone: "Human judgment only. Treat this as a replay finding to investigate.",
    buttonClass: "border-rose-300 text-rose-800 hover:border-rose-400",
  },
};

const checkpointStatusCopy: Record<
  ReplayCheckpointStatus,
  { label: string; buttonClass: string; cardClass: string }
> = {
  pending: {
    label: "Pending",
    buttonClass: "border-stone-300 text-stone-700 hover:border-stone-400",
    cardClass: "border-stone-200 bg-white/80",
  },
  observed: {
    label: "Observed",
    buttonClass: "border-emerald-300 text-emerald-800 hover:border-emerald-400",
    cardClass: "border-emerald-300 bg-emerald-50/80",
  },
  failed: {
    label: "Failed",
    buttonClass: "border-rose-300 text-rose-800 hover:border-rose-400",
    cardClass: "border-rose-300 bg-rose-50/80",
  },
};

function decisionSummary(decision: PresenceGuardDecision) {
  if (decision.outcome === "surfaced") {
    return "Cue surfaced";
  }

  if (decision.reasons.length === 0) {
    return "No cue candidate";
  }

  return decision.reasons.join(", ").replaceAll("_", " ");
}

function snapshotLabel(currentSnapshotIndex: number, totalTurns: number) {
  if (currentSnapshotIndex === 0) {
    return "Seed snapshot";
  }

  return `Turn ${currentSnapshotIndex} of ${totalTurns}`;
}

function isCheckpointActive(
  checkpoint: ReplayFixtureCheckpoint,
  currentSnapshotIndex: number,
) {
  return (
    currentSnapshotIndex >= checkpoint.targetStartSnapshotIndex &&
    currentSnapshotIndex <= checkpoint.targetEndSnapshotIndex
  );
}

function findCurrentCheckpoint(
  fixture: ReplayFixtureDefinition | null,
  currentSnapshotIndex: number,
) {
  if (!fixture) {
    return null;
  }

  return (
    fixture.checkpoints.find((checkpoint) =>
      isCheckpointActive(checkpoint, currentSnapshotIndex),
    ) ?? null
  );
}

function getCheckpointRangeLabel(checkpoint: ReplayFixtureCheckpoint) {
  if (checkpoint.targetStartSnapshotIndex === checkpoint.targetEndSnapshotIndex) {
    return `Snapshot ${checkpoint.targetStartSnapshotIndex}`;
  }

  return `Snapshots ${checkpoint.targetStartSnapshotIndex}-${checkpoint.targetEndSnapshotIndex}`;
}

function formatReviewStatus(status: FixtureReviewStatus | null) {
  if (!status) {
    return "No fixture loaded";
  }

  return status.replaceAll("_", " ");
}

function countCheckpointStatuses(
  checkpoints: ReplayFixtureCheckpoint[],
  reviews: Record<string, ReplayCheckpointReview>,
) {
  return checkpoints.reduce(
    (counts, checkpoint) => {
      const status = reviews[checkpoint.id]?.status ?? "pending";

      if (status === "observed") {
        counts.observed += 1;
      }

      if (status === "failed") {
        counts.failed += 1;
      }

      return counts;
    },
    { observed: 0, failed: 0 },
  );
}

export function ReplayValidationGuide({
  activeFixture,
  replaySourceLabel,
  replaySourceDetail,
  currentSnapshotIndex,
  totalTurns,
  surfacedCue,
  topMove,
  leadThread,
  currentDecision,
  assessment,
  onAssessmentChange,
  isFixtureRunModified,
  fixtureReviewStatus,
  checkpointReviews,
  selectedCheckpointId,
  onCheckpointStatusChange,
  onCheckpointNoteChange,
  onCheckpointJump,
}: ReplayValidationGuideProps) {
  const currentAssessment = assessment ?? "pending";
  const assessmentState = assessmentCopy[currentAssessment];
  const currentCheckpoint = findCurrentCheckpoint(activeFixture, currentSnapshotIndex);
  const selectedCheckpoint = activeFixture?.checkpoints.find(
    (checkpoint) => checkpoint.id === selectedCheckpointId,
  ) ?? null;
  const checkpointFocus = currentCheckpoint ?? selectedCheckpoint ?? null;
  const checkpointCounts = activeFixture
    ? countCheckpointStatuses(activeFixture.checkpoints, checkpointReviews)
    : { observed: 0, failed: 0 };
  const pendingCheckpointCount = activeFixture
    ? activeFixture.checkpoints.length -
      checkpointCounts.observed -
      checkpointCounts.failed
    : 0;
  const nextPendingCheckpoint =
    activeFixture?.checkpoints.find(
      (checkpoint) =>
        (checkpointReviews[checkpoint.id]?.status ?? "pending") === "pending",
    ) ?? null;

  return (
    <section id="fixture-proof-guide" className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="eyebrow">Replay validation</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-900">
            Fixture proof guide
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            {replaySourceDetail}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Replay position
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {snapshotLabel(currentSnapshotIndex, totalTurns)}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Snapshot {currentSnapshotIndex} / {totalTurns}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Active source
          </p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {activeFixture ? activeFixture.label : replaySourceLabel}
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            {activeFixture
              ? activeFixture.goal
              : "Load one of the three fixtures to start a clean proof run. Seeded, imported, or manually extended replay streams are useful for exploration but should not be treated as fixture proof."}
          </p>
          {isFixtureRunModified ? (
            <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              This fixture run has replay-local additions on top of the loaded
              baseline. Keep using it for exploration if you want, but do not
              treat it as a clean fixture proof result.
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white/80 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Operator assessment
          </p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {assessmentState.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            {assessmentState.tone}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              ["pending", "appears_to_pass", "appears_to_fail"] as const
            ).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onAssessmentChange(value)}
                disabled={!activeFixture}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  currentAssessment === value
                    ? assessmentCopy[value].buttonClass
                    : "border-stone-300 text-stone-700 hover:border-stone-400"
                }`}
              >
                {assessmentCopy[value].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Total checkpoints
          </p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">
            {activeFixture ? activeFixture.checkpoints.length : 0}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Observed
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">
            {checkpointCounts.observed}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Failed
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">
            {checkpointCounts.failed}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Review state
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {formatReviewStatus(fixtureReviewStatus)}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {activeFixture
              ? fixtureReviewStatus === "not_started"
                ? "No checkpoint has been marked yet."
                : pendingCheckpointCount > 0
                ? `${pendingCheckpointCount} checkpoint${pendingCheckpointCount === 1 ? "" : "s"} still need operator judgment.`
                : fixtureReviewStatus === "completed_with_failures"
                  ? "Every checkpoint has been reviewed and at least one failed."
                  : "Every checkpoint has been reviewed and all were observed."
              : "Load a fixture to begin a disciplined review."}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Next pending
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {nextPendingCheckpoint?.label ?? "None"}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {nextPendingCheckpoint
              ? getCheckpointRangeLabel(nextPendingCheckpoint)
              : "No unchecked checkpoint remains for this fixture."}
          </p>
        </article>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Surfaced cue
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {surfacedCue?.text ?? "No cue surfaced"}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Lead thread
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {leadThread?.label ?? "No unresolved lead thread"}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Current decision
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {decisionSummary(currentDecision)}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {topMove ? `Top move: ${topMove.label}` : "No top move available."}
          </p>
        </article>
      </div>

      {activeFixture ? (
        <>
          <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Checkpoint focus
            </p>
            <p className="mt-2 text-xl font-semibold text-stone-900">
              {checkpointFocus?.label ?? "No checkpoint selected yet"}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {checkpointFocus
                ? currentCheckpoint?.id === checkpointFocus.id
                  ? `You are currently inside ${getCheckpointRangeLabel(checkpointFocus)}.`
                  : `Selected checkpoint targets ${getCheckpointRangeLabel(checkpointFocus)}. Use jump to move there.`
                : "Select a checkpoint below to jump directly to the important moment and mark what you observe."}
            </p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                Checkpoints
              </p>
              <div className="mt-3 space-y-3">
                {activeFixture.checkpoints.map((checkpoint) => {
                  const review = checkpointReviews[checkpoint.id];
                  const status = review?.status ?? "pending";
                  const isActive = isCheckpointActive(
                    checkpoint,
                    currentSnapshotIndex,
                  );
                  const isSelected = selectedCheckpointId === checkpoint.id;

                  return (
                    <article
                      key={checkpoint.id}
                      className={`rounded-2xl border p-4 ${
                        isActive
                          ? "border-amber-300 bg-amber-50/80"
                          : checkpointStatusCopy[status].cardClass
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-stone-900">
                            {checkpoint.label}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                            {getCheckpointRangeLabel(checkpoint)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {isActive ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs uppercase tracking-[0.14em] text-amber-900">
                              Current
                            </span>
                          ) : null}
                          {isSelected && !isActive ? (
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs uppercase tracking-[0.14em] text-stone-700">
                              Selected
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-stone-700">
                        <span className="font-semibold text-stone-900">
                          Inspect:
                        </span>{" "}
                        {checkpoint.inspect}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-700">
                        <span className="font-semibold text-stone-900">
                          Expected:
                        </span>{" "}
                        {checkpoint.expected}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-700">
                        <span className="font-semibold text-stone-900">
                          Failure:
                        </span>{" "}
                        {checkpoint.failure}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onCheckpointJump(checkpoint.id)}
                          className="rounded-full border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-400"
                        >
                          Jump to checkpoint
                        </button>
                        {(
                          ["pending", "observed", "failed"] as const
                        ).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              onCheckpointStatusChange(checkpoint.id, value)
                            }
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              status === value
                                ? checkpointStatusCopy[value].buttonClass
                                : "border-stone-300 text-stone-700 hover:border-stone-400"
                            }`}
                          >
                            {checkpointStatusCopy[value].label}
                          </button>
                        ))}
                      </div>

                      <label className="mt-4 block">
                        <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                          Operator note
                        </span>
                        <textarea
                          value={review?.note ?? ""}
                          onChange={(event) =>
                            onCheckpointNoteChange(
                              checkpoint.id,
                              event.target.value,
                            )
                          }
                          rows={2}
                          className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900"
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Inspect these panels
                </p>
                <div className="mt-3 space-y-3">
                  {activeFixture.inspectAreas.map((item) => (
                    <article
                      key={item}
                      className="rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm leading-6 text-stone-800"
                    >
                      {item}
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Fixture-level expectations
                </p>
                <div className="mt-3 space-y-3">
                  {activeFixture.expectedBehaviors.map((item) => (
                    <article
                      key={item}
                      className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-sm leading-6 text-stone-800"
                    >
                      {item}
                    </article>
                  ))}
                </div>
              </div>

              <article className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">
                  Success looks like
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-950">
                  {activeFixture.successSignal}
                </p>
              </article>

              <article className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-rose-700">
                  Failure means
                </p>
                <p className="mt-2 text-sm leading-6 text-rose-950">
                  {activeFixture.failureSignal}
                </p>
              </article>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
