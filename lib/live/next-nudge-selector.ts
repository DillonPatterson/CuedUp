import type {
  TranscriptNextNudgeCandidate,
  TranscriptNextNudgePromptAngle,
  TranscriptNextNudgeSelection,
  TranscriptNextNudgeSourceKind,
  TranscriptOrganizationSnapshot,
  TranscriptRecallCandidate,
  TranscriptRecallReadinessBand,
  TranscriptRecallRecency,
  TranscriptRecallRelevance,
} from "@/lib/transcript/organization/types";

const MAX_BACKUP_NUDGES = 3;

type NextNudgeSelectorInput = Omit<TranscriptOrganizationSnapshot, "nextNudge">;

function readinessRank(value: TranscriptRecallReadinessBand) {
  switch (value) {
    case "urgent":
      return 4;
    case "ready":
      return 3;
    case "warming":
      return 2;
    default:
      return 1;
  }
}

function recencyRank(value: TranscriptRecallRecency) {
  switch (value) {
    case "fresh":
      return 3;
    case "recent":
      return 2;
    default:
      return 1;
  }
}

function relevanceRank(value: TranscriptRecallRelevance) {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function affectiveRank(value: TranscriptRecallCandidate["affectiveWeight"]) {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function mapSourceKind(
  candidate: TranscriptRecallCandidate,
): TranscriptNextNudgeSourceKind {
  if (
    candidate.interrupted &&
    candidate.completionDebtScore >= 4 &&
    (candidate.sourceKind === "claim" || candidate.sourceKind === "thread_cue")
  ) {
    return "interruption";
  }

  switch (candidate.sourceKind) {
    case "thread_cue":
      return "thread";
    case "claim":
      return "claim";
    case "tension":
      return "tension";
    case "theme":
      return "theme";
  }
}

function getPromptAngle(
  sourceKind: TranscriptNextNudgeSourceKind,
  candidate: TranscriptRecallCandidate,
): TranscriptNextNudgePromptAngle {
  if (sourceKind === "interruption") {
    return "return_to_interruption";
  }

  if (sourceKind === "tension") {
    return "test_contradiction";
  }

  if (sourceKind === "claim") {
    return candidate.completionDebtScore >= 4 ? "clarify" : "press_gently";
  }

  if (sourceKind === "thread") {
    return candidate.readiness === "urgent" || candidate.readiness === "ready"
      ? "circle_back"
      : "clarify";
  }

  if (candidate.affectiveWeight === "high") {
    return "press_gently";
  }

  return "circle_back";
}

function buildReason(candidate: TranscriptRecallCandidate) {
  const fragments = new Set<string>();
  const baseReason = candidate.reason.toLowerCase();

  if (candidate.interrupted) {
    fragments.add("unfinished prior answer");
  }

  if (
    candidate.completionDebtScore >= 7 &&
    !baseReason.includes("high debt")
  ) {
    fragments.add("high completion debt");
  } else if (
    candidate.completionDebtScore >= 4 &&
    !baseReason.includes("rising debt")
  ) {
    fragments.add("rising completion debt");
  }

  if (
    candidate.affectiveWeight === "high" &&
    !baseReason.includes("affective weight")
  ) {
    fragments.add("high affective weight");
  } else if (
    candidate.affectiveWeight === "medium" &&
    !baseReason.includes("affective weight")
  ) {
    fragments.add("medium affective weight");
  }

  if (
    candidate.relevanceToCurrentTurn !== "low" &&
    !baseReason.includes("relevance")
  ) {
    fragments.add(`${candidate.relevanceToCurrentTurn} relevance to current turn`);
  }

  if (candidate.reason) {
    fragments.add(candidate.reason);
  }

  return Array.from(fragments).join(", ");
}

function buildRankingScore(candidate: TranscriptRecallCandidate) {
  const sourceKind = mapSourceKind(candidate);
  const sourceBoost =
    sourceKind === "interruption"
      ? 3
      : sourceKind === "tension"
        ? 2.25
        : sourceKind === "thread"
          ? 2
          : sourceKind === "claim"
            ? 1.5
            : 1;

  // These weights are provisional deterministic tuning for replay inspection,
  // not calibrated truth about real interview performance.
  return (
    readinessRank(candidate.readiness) * 4 +
    relevanceRank(candidate.relevanceToCurrentTurn) * 3 +
    recencyRank(candidate.recency) * 2 +
    affectiveRank(candidate.affectiveWeight) +
    // Completion debt is already clamped upstream; the selector caps its
    // contribution further so debt cannot dominate every other signal.
    Math.min(candidate.completionDebtScore, 8) +
    (candidate.interrupted ? 2 : 0) +
    sourceBoost
  );
}

function toNextNudgeCandidate(
  candidate: TranscriptRecallCandidate,
): TranscriptNextNudgeCandidate {
  const sourceKind = mapSourceKind(candidate);

  return {
    id: `next-nudge:${candidate.id}`,
    label: candidate.label,
    sourceKind,
    promptAngle: getPromptAngle(sourceKind, candidate),
    readiness: candidate.readiness,
    reason: buildReason(candidate),
    supportingTurnIds: candidate.turnIds,
    debtScore: candidate.completionDebtScore,
    affectiveWeight: candidate.affectiveWeight,
    interrupted: candidate.interrupted,
  };
}

function buildFallbackCandidate(
  organization: NextNudgeSelectorInput,
): TranscriptNextNudgeCandidate {
  const totalSignals =
    organization.openThreads.length +
    organization.notableClaims.length +
    organization.tensionWatch.length;

  return {
    id: "next-nudge:let-it-breathe",
    label: "Let it breathe",
    // The fallback is a selector directive, not transcript-derived content.
    sourceKind: "directive",
    promptAngle: "let_it_breathe",
    readiness: "not_ready",
    reason:
      totalSignals > 0
        ? "Nothing is materially ready enough to justify a stronger conversational move yet."
        : "No open thread, claim, or tension signal is strong enough yet.",
    supportingTurnIds: [],
    debtScore: 0,
    affectiveWeight: "low",
    interrupted: false,
  };
}

export function selectNextNudgeSelection(
  organization: NextNudgeSelectorInput,
): TranscriptNextNudgeSelection {
  if (organization.recallCandidates.length === 0) {
    return {
      bestCandidate: buildFallbackCandidate(organization),
      backupCandidates: [],
    };
  }

  const rankedCandidates = [...organization.recallCandidates].sort(
    (left, right) => buildRankingScore(right) - buildRankingScore(left),
  );
  const topCandidate = rankedCandidates[0] ?? null;

  if (!topCandidate) {
    return {
      bestCandidate: buildFallbackCandidate(organization),
      backupCandidates: [],
    };
  }

  const topScore = buildRankingScore(topCandidate);
  const shouldFallback =
    topCandidate.readiness === "not_ready" && topScore < 14;

  return {
    bestCandidate: shouldFallback
      ? buildFallbackCandidate(organization)
      : toNextNudgeCandidate(topCandidate),
    backupCandidates: rankedCandidates
      .filter((candidate) => candidate.id !== topCandidate.id)
      .slice(0, MAX_BACKUP_NUDGES)
      .map(toNextNudgeCandidate),
  };
}
