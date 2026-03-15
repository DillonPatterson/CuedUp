import type { TranscriptTurn } from "@/types";
import type {
  TranscriptCompletionDebtEntry,
  TranscriptDebtReason,
  TranscriptDerivedAnnotationKind,
  TranscriptOrganizationSourceMetadata,
  TranscriptRecallReadinessBand,
} from "@/lib/transcript/organization/types";

const RESOLUTION_PATTERNS = [
  /\bthat'?s the connection\b/i,
  /\bthat is the connection\b/i,
  /\bthat'?s why\b/i,
  /\bthe answer is\b/i,
  /\bwhat changed was\b/i,
  /\bin the end\b/i,
  /\bso the point is\b/i,
  /\byes,\s*and\b/i,
];

export type CompletionDebtSourceGroup = {
  key: string;
  label: string;
  sourceKind: Exclude<TranscriptDerivedAnnotationKind, "entity">;
  turnIds: string[];
  occurrenceCount: number;
  currentTurnLinked: boolean;
  lastSeenTurnId: string;
  lastSeenAt: string | null;
  lastSeenIndex: number;
  openedAtTurnId: string;
  openedAtIndex: number;
};

function clamp(value: number, min = 0, max = 10) {
  return Math.min(max, Math.max(min, value));
}

function getBringBackPriority(
  debtScore: number,
): TranscriptRecallReadinessBand {
  if (debtScore >= 7) {
    return "urgent";
  }

  if (debtScore >= 5) {
    return "ready";
  }

  if (debtScore >= 3) {
    return "warming";
  }

  return "not_ready";
}

function hasResolutionLanguage(text: string) {
  return RESOLUTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildTranscriptCompletionDebt(
  turns: TranscriptTurn[],
  sourceMetadataByTurnId: Record<string, TranscriptOrganizationSourceMetadata>,
  groups: CompletionDebtSourceGroup[],
): TranscriptCompletionDebtEntry[] {
  const turnById = turns.reduce<Record<string, TranscriptTurn>>((result, turn) => {
    result[turn.id] = turn;
    return result;
  }, {});
  const currentTurnIndex = turns.length - 1;

  return groups.map((group) => {
    const latestTurn = turnById[group.lastSeenTurnId];
    const latestMetadata = sourceMetadataByTurnId[group.lastSeenTurnId];
    const interruptingTurn = turns[group.lastSeenIndex + 1] ?? null;
    const interruptingMetadata = interruptingTurn
      ? sourceMetadataByTurnId[interruptingTurn.id]
      : null;
    const interrupted =
      interruptingMetadata?.analysis.interruption.interruptedPreviousTurn === true &&
      interruptingMetadata.analysis.interruption.previousTurnId === group.lastSeenTurnId &&
      latestTurn?.speaker === "guest";
    const completionStatus =
      latestMetadata?.analysis.completion.completionStatus ?? "complete";
    const affectiveWeight =
      latestMetadata?.analysis.affective.intensity ?? "low";
    const hasDeflection =
      latestMetadata?.analysis.lexical.hits.some(
        (hit) => hit.tier === "deflection",
      ) ?? false;
    const turnsSinceLastSeen =
      currentTurnIndex >= 0 ? currentTurnIndex - group.lastSeenIndex : 0;
    const hasRecentRevisit =
      group.occurrenceCount >= 2 && turnsSinceLastSeen <= 2;
    const resolved = latestTurn ? hasResolutionLanguage(latestTurn.text) : false;
    const reasons = new Set<TranscriptDebtReason>(["opened_unresolved"]);
    let debtScore = 1;

    if (completionStatus === "incomplete") {
      debtScore += 1;
      reasons.add("incomplete_turn");
    }

    if (completionStatus === "truncated") {
      debtScore += 2;
      reasons.add("truncated_turn");
    }

    if (interrupted) {
      debtScore += 2;
      reasons.add("interruption");
    }

    if (affectiveWeight === "medium") {
      debtScore += 1;
      reasons.add("affective_weight");
    }

    if (affectiveWeight === "high") {
      debtScore += 2;
      reasons.add("affective_weight");
    }

    if (hasDeflection) {
      debtScore += 1;
      reasons.add("deflection");
    }

    if (turnsSinceLastSeen >= 3 && !resolved) {
      debtScore += 1;
      reasons.add("stale_unresolved");
    }

    if (hasRecentRevisit) {
      debtScore -= 1;
      reasons.add("revisited");
    }

    if (resolved) {
      debtScore -= 2;
      reasons.add("resolution_language");
    }

    if (group.currentTurnLinked && completionStatus === "complete") {
      debtScore -= 1;
    }

    const clampedDebtScore = clamp(debtScore);

    return {
      id: `debt:${group.key}`,
      label: group.label,
      sourceKind: group.sourceKind,
      openedAtTurnId: group.openedAtTurnId,
      lastSeenTurnId: group.lastSeenTurnId,
      lastSeenAt: group.lastSeenAt,
      turnIds: group.turnIds,
      debtScore: clampedDebtScore,
      debtReasons: Array.from(reasons),
      interrupted,
      affectiveWeight,
      completionStatus,
      currentTurnLinked: group.currentTurnLinked,
      bringBackPriority: getBringBackPriority(clampedDebtScore),
    };
  });
}
