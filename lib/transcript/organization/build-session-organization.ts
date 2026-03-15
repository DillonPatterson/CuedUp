import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import type { ReplayCommittedTurnMetadata } from "@/lib/transcript/manual-turns";
import { buildReplayDossierLexicon } from "@/lib/transcript/lexical-tiers";
import { analyzeReplayCommittedTurn } from "@/lib/transcript/turn-analysis";
import { extractReplayTurnMemory } from "@/lib/transcript/turn-memory";
import { buildTranscriptCompletionDebt } from "@/lib/transcript/organization/build-completion-debt";
import {
  buildAnnotationsFromReplayMetadata,
} from "@/lib/transcript/organization/from-replay-metadata";
import type {
  TranscriptCompletionDebtEntry,
  TranscriptDerivedAnnotation,
  TranscriptOrganizationBucketItem,
  TranscriptOrganizationSnapshot,
  TranscriptOrganizationSalience,
  TranscriptOrganizationSourceMetadata,
  TranscriptRecallCandidate,
  TranscriptRecallReadinessBand,
  TranscriptRecallRecency,
  TranscriptRecallRelevance,
} from "@/lib/transcript/organization/types";

const EMERGING_THEME_WINDOW = 6;
const MAX_BUCKET_ITEMS = 4;
const MAX_RECALL_CANDIDATES = 5;

type BuildReplayTranscriptOrganizationOptions = {
  handoff?: DossierLiveHandoff | null;
};

type GroupedAnnotation = {
  key: string;
  label: string;
  sourceKind: TranscriptDerivedAnnotation["kind"];
  turnIds: string[];
  occurrenceCount: number;
  salience: TranscriptOrganizationSalience;
  currentTurnLinked: boolean;
  lastSeenTurnId: string | null;
  lastSeenAt: string | null;
  lastSeenIndex: number;
  openedAtTurnId: string | null;
  openedAtIndex: number;
};

function isDebtSourceKind(
  value: TranscriptDerivedAnnotation["kind"],
): value is Exclude<TranscriptDerivedAnnotation["kind"], "entity"> {
  return value !== "entity";
}

function salienceRank(value: TranscriptOrganizationSalience) {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function recallRecencyRank(value: TranscriptRecallRecency) {
  switch (value) {
    case "fresh":
      return 3;
    case "recent":
      return 2;
    default:
      return 1;
  }
}

function recallRelevanceRank(value: TranscriptRecallRelevance) {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function recallReadinessRank(value: TranscriptRecallReadinessBand) {
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

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatDebtReason(value: string) {
  return value.replaceAll("_", " ");
}

function collectUniqueLabels(
  annotations: TranscriptDerivedAnnotation[],
  kind: TranscriptDerivedAnnotation["kind"],
) {
  const seen = new Set<string>();

  return annotations.reduce<string[]>((labels, annotation) => {
    if (annotation.kind !== kind || seen.has(annotation.label)) {
      return labels;
    }

    seen.add(annotation.label);
    labels.push(annotation.label);
    return labels;
  }, []);
}

function resolveTurnMetadata(
  turn: TranscriptTurn,
  previousTurn: TranscriptTurn | null,
  replayMetadata: ReplayCommittedTurnMetadata | undefined,
  dossierLexicon: ReturnType<typeof buildReplayDossierLexicon>,
): TranscriptOrganizationSourceMetadata {
  if (replayMetadata && !dossierLexicon) {
    return {
      analysis: replayMetadata.analysis,
      memory: replayMetadata.memory,
    };
  }

  const analysis = analyzeReplayCommittedTurn(turn, {
    previousTurn,
    dossierLexicon,
  });

  return {
    analysis,
    memory: extractReplayTurnMemory(turn, analysis),
  };
}

function buildAnnotationsByTurnId(
  turns: TranscriptTurn[],
  annotations: TranscriptDerivedAnnotation[],
) {
  const annotationsByTurnId = turns.reduce<
    Record<string, TranscriptDerivedAnnotation[]>
  >((result, turn) => {
    result[turn.id] = [];
    return result;
  }, {});

  annotations.forEach((annotation) => {
    if (!annotationsByTurnId[annotation.turnId]) {
      annotationsByTurnId[annotation.turnId] = [];
    }

    annotationsByTurnId[annotation.turnId].push(annotation);
  });

  return annotationsByTurnId;
}

function buildGroupedAnnotations(
  annotations: TranscriptDerivedAnnotation[],
  turns: TranscriptTurn[],
) {
  const turnIndexById = turns.reduce<Record<string, number>>((result, turn, index) => {
    result[turn.id] = index;
    return result;
  }, {});
  const turnById = turns.reduce<Record<string, TranscriptTurn>>((result, turn) => {
    result[turn.id] = turn;
    return result;
  }, {});
  const currentTurnId = turns.at(-1)?.id ?? null;
  const groups = new Map<string, GroupedAnnotation>();

  annotations.forEach((annotation) => {
    const key = `${annotation.kind}:${normalizeSearchText(annotation.label)}`;
    const turnIndex = turnIndexById[annotation.turnId] ?? -1;
    const turn = turnById[annotation.turnId];
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        label: annotation.label,
        sourceKind: annotation.kind,
        turnIds: [annotation.turnId],
        occurrenceCount: 1,
        salience: annotation.salience,
        currentTurnLinked: annotation.turnId === currentTurnId,
        lastSeenTurnId: annotation.turnId,
        lastSeenAt: turn?.timestamp ?? null,
        lastSeenIndex: turnIndex,
        openedAtTurnId: annotation.turnId,
        openedAtIndex: turnIndex,
      });
      return;
    }

    if (!existing.turnIds.includes(annotation.turnId)) {
      existing.turnIds.push(annotation.turnId);
      existing.occurrenceCount += 1;
    }

    if (salienceRank(annotation.salience) > salienceRank(existing.salience)) {
      existing.salience = annotation.salience;
    }

    if (annotation.turnId === currentTurnId) {
      existing.currentTurnLinked = true;
    }

    if (turnIndex <= existing.openedAtIndex) {
      existing.openedAtIndex = turnIndex;
      existing.openedAtTurnId = annotation.turnId;
    }

    if (turnIndex >= existing.lastSeenIndex) {
      existing.lastSeenIndex = turnIndex;
      existing.lastSeenTurnId = annotation.turnId;
      existing.lastSeenAt = turn?.timestamp ?? null;
    }
  });

  return {
    currentTurnId,
    turnIndexById,
    groups: Array.from(groups.values()),
  };
}

function buildDebtLookupKey(label: string, sourceKind: TranscriptDerivedAnnotation["kind"]) {
  return `${sourceKind}:${normalizeSearchText(label)}`;
}

function toDebtMap(completionDebt: TranscriptCompletionDebtEntry[]) {
  return completionDebt.reduce<Record<string, TranscriptCompletionDebtEntry>>(
    (result, entry) => {
      result[buildDebtLookupKey(entry.label, entry.sourceKind)] = entry;
      return result;
    },
    {},
  );
}

function sortBucketItems(
  left: TranscriptOrganizationBucketItem,
  right: TranscriptOrganizationBucketItem,
) {
  if (left.currentTurnLinked !== right.currentTurnLinked) {
    return left.currentTurnLinked ? -1 : 1;
  }

  const debtDelta =
    (right.completionDebtScore ?? 0) - (left.completionDebtScore ?? 0);

  if (debtDelta !== 0) {
    return debtDelta;
  }

  const salienceDelta =
    salienceRank(right.salience) - salienceRank(left.salience);

  if (salienceDelta !== 0) {
    return salienceDelta;
  }

  const occurrenceDelta = right.occurrenceCount - left.occurrenceCount;

  if (occurrenceDelta !== 0) {
    return occurrenceDelta;
  }

  return left.label.localeCompare(right.label);
}

function buildBucketItem(
  group: GroupedAnnotation,
  debtMap: Record<string, TranscriptCompletionDebtEntry>,
): TranscriptOrganizationBucketItem {
  const completionDebt = debtMap[group.key];

  return {
    id: `bucket:${group.key}`,
    label: group.label,
    sourceKind: group.sourceKind,
    turnIds: group.turnIds,
    occurrenceCount: group.occurrenceCount,
    salience: group.salience,
    currentTurnLinked: group.currentTurnLinked,
    lastSeenTurnId: group.lastSeenTurnId,
    lastSeenAt: group.lastSeenAt,
    completionDebtScore: completionDebt?.debtScore,
    completionDebtReasons: completionDebt?.debtReasons,
    interrupted: completionDebt?.interrupted,
    affectiveWeight: completionDebt?.affectiveWeight,
    completionStatus: completionDebt?.completionStatus,
    bringBackPriority: completionDebt?.bringBackPriority,
  };
}

function buildEmergingThemes(
  groups: GroupedAnnotation[],
  totalTurnCount: number,
  debtMap: Record<string, TranscriptCompletionDebtEntry>,
) {
  const minimumRecentIndex = Math.max(0, totalTurnCount - EMERGING_THEME_WINDOW);

  return groups
    .filter(
      (group) =>
        group.sourceKind === "theme" &&
        group.occurrenceCount >= 2 &&
        group.lastSeenIndex >= minimumRecentIndex,
    )
    .map((group) => buildBucketItem(group, debtMap))
    .sort(sortBucketItems)
    .slice(0, MAX_BUCKET_ITEMS);
}

function buildOpenThreads(
  groups: GroupedAnnotation[],
  debtMap: Record<string, TranscriptCompletionDebtEntry>,
) {
  return groups
    .filter((group) => group.sourceKind === "thread_cue")
    .map((group) => buildBucketItem(group, debtMap))
    .sort(sortBucketItems)
    .slice(0, MAX_BUCKET_ITEMS);
}

function buildNotableClaims(
  groups: GroupedAnnotation[],
  debtMap: Record<string, TranscriptCompletionDebtEntry>,
) {
  return groups
    .filter((group) => group.sourceKind === "claim")
    .map((group) => buildBucketItem(group, debtMap))
    .sort(sortBucketItems)
    .slice(0, MAX_BUCKET_ITEMS);
}

function buildTensionWatch(
  groups: GroupedAnnotation[],
  debtMap: Record<string, TranscriptCompletionDebtEntry>,
) {
  return groups
    .filter((group) => group.sourceKind === "tension")
    .map((group) => buildBucketItem(group, debtMap))
    .sort(sortBucketItems)
    .slice(0, MAX_BUCKET_ITEMS);
}

function getRecallRecency(
  currentTurnIndex: number,
  lastSeenTurnId: string | null,
  turnIndexById: Record<string, number>,
): TranscriptRecallRecency {
  const lastSeenIndex =
    lastSeenTurnId ? turnIndexById[lastSeenTurnId] ?? -1 : -1;
  const turnsSinceLastSeen =
    lastSeenIndex >= 0 ? currentTurnIndex - lastSeenIndex : Number.POSITIVE_INFINITY;

  if (turnsSinceLastSeen <= 1) {
    return "fresh";
  }

  if (turnsSinceLastSeen <= 4) {
    return "recent";
  }

  return "stale";
}

function hasLexicalAnchor(candidateLabel: string, currentTurnText: string) {
  const currentTurnTokens = new Set(
    normalizeSearchText(currentTurnText)
      .split(" ")
      .filter((token) => token.length >= 4),
  );

  return normalizeSearchText(candidateLabel)
    .split(" ")
    .filter((token) => token.length >= 4)
    .some((token) => currentTurnTokens.has(token));
}

function getRecallRelevance(
  item: TranscriptOrganizationBucketItem,
  currentTurnAnnotations: TranscriptDerivedAnnotation[],
  currentTurnText: string | null,
): TranscriptRecallRelevance {
  if (item.currentTurnLinked) {
    return "high";
  }

  if (currentTurnAnnotations.some((annotation) => annotation.kind === item.sourceKind)) {
    return "medium";
  }

  if (!currentTurnText) {
    return "low";
  }

  const normalizedTurnText = normalizeSearchText(currentTurnText);
  const normalizedLabel = normalizeSearchText(item.label);

  if (normalizedLabel && normalizedTurnText.includes(normalizedLabel)) {
    return "medium";
  }

  if (hasLexicalAnchor(item.label, currentTurnText)) {
    return "medium";
  }

  return "low";
}

function getRecallReadiness(
  item: TranscriptOrganizationBucketItem,
  recency: TranscriptRecallRecency,
  relevance: TranscriptRecallRelevance,
  debtScore: number,
): TranscriptRecallReadinessBand {
  if (
    item.sourceKind === "tension" &&
    relevance === "high" &&
    salienceRank(item.salience) >= 2
  ) {
    return "urgent";
  }

  if (
    item.sourceKind === "thread_cue" &&
    recency === "fresh" &&
    relevance === "high"
  ) {
    return "urgent";
  }

  const readinessScore =
    salienceRank(item.salience) +
    recallRecencyRank(recency) +
    recallRelevanceRank(relevance) +
    (item.occurrenceCount >= 2 ? 1 : 0) +
    (debtScore >= 7 ? 2 : debtScore >= 4 ? 1 : 0);

  if (readinessScore >= 8) {
    return "urgent";
  }

  if (readinessScore >= 6) {
    return "ready";
  }

  if (readinessScore >= 4) {
    return "warming";
  }

  return "not_ready";
}

function buildRecallReason(
  item: TranscriptOrganizationBucketItem,
  recency: TranscriptRecallRecency,
  relevance: TranscriptRecallRelevance,
  completionDebt: TranscriptCompletionDebtEntry | undefined,
) {
  const fragments: string[] = [];

  if (completionDebt) {
    if (completionDebt.debtScore >= 7) {
      fragments.push("high debt");
    } else if (completionDebt.debtScore >= 4) {
      fragments.push("rising debt");
    }

    const strongestDebtReason = completionDebt.debtReasons.find(
      (reason) => reason !== "opened_unresolved",
    );

    if (strongestDebtReason) {
      fragments.push(formatDebtReason(strongestDebtReason));
    }
  }

  if (item.currentTurnLinked) {
    fragments.push("linked to current turn");
  } else {
    fragments.push(`${recency} signal`);
  }

  if (item.occurrenceCount >= 2) {
    fragments.push(`seen ${item.occurrenceCount} times`);
  }

  if (relevance !== "low") {
    fragments.push(`${relevance} relevance`);
  }

  return fragments.join(", ");
}

function buildRecallCandidates(
  currentTurnAnnotations: TranscriptDerivedAnnotation[],
  currentTurnText: string | null,
  groupedAnnotations: ReturnType<typeof buildGroupedAnnotations>,
  emergingThemes: TranscriptOrganizationBucketItem[],
  openThreads: TranscriptOrganizationBucketItem[],
  notableClaims: TranscriptOrganizationBucketItem[],
  tensionWatch: TranscriptOrganizationBucketItem[],
  debtMap: Record<string, TranscriptCompletionDebtEntry>,
): TranscriptRecallCandidate[] {
  const currentTurnIndex =
    groupedAnnotations.currentTurnId
      ? groupedAnnotations.turnIndexById[groupedAnnotations.currentTurnId] ?? -1
      : -1;

  return [
    ...openThreads,
    ...notableClaims,
    ...tensionWatch,
    ...emergingThemes,
  ]
    .map((item) => {
      const recency = getRecallRecency(
        currentTurnIndex,
        item.lastSeenTurnId,
        groupedAnnotations.turnIndexById,
      );
      const relevanceToCurrentTurn = getRecallRelevance(
        item,
        currentTurnAnnotations,
        currentTurnText,
      );
      const completionDebt = debtMap[buildDebtLookupKey(item.label, item.sourceKind)];
      const completionDebtScore = completionDebt?.debtScore ?? 0;

      return {
        id: `recall:${item.id}`,
        label: item.label,
        sourceKind: item.sourceKind as TranscriptRecallCandidate["sourceKind"],
        turnIds: item.turnIds,
        salience: item.salience,
        recency,
        lastSeenAt: item.lastSeenAt,
        relevanceToCurrentTurn,
        readiness: getRecallReadiness(
          item,
          recency,
          relevanceToCurrentTurn,
          completionDebtScore,
        ),
        completionDebtScore,
        completionDebtReasons: completionDebt?.debtReasons ?? [],
        interrupted: completionDebt?.interrupted ?? false,
        affectiveWeight: completionDebt?.affectiveWeight ?? "low",
        reason: buildRecallReason(
          item,
          recency,
          relevanceToCurrentTurn,
          completionDebt,
        ),
      };
    })
    .sort((left, right) => {
      const readinessDelta =
        recallReadinessRank(right.readiness) -
        recallReadinessRank(left.readiness);

      if (readinessDelta !== 0) {
        return readinessDelta;
      }

      const relevanceDelta =
        recallRelevanceRank(right.relevanceToCurrentTurn) -
        recallRelevanceRank(left.relevanceToCurrentTurn);

      if (relevanceDelta !== 0) {
        return relevanceDelta;
      }

      const debtDelta = right.completionDebtScore - left.completionDebtScore;

      if (debtDelta !== 0) {
        return debtDelta;
      }

      const recencyDelta =
        recallRecencyRank(right.recency) - recallRecencyRank(left.recency);

      if (recencyDelta !== 0) {
        return recencyDelta;
      }

      const salienceDelta =
        salienceRank(right.salience) - salienceRank(left.salience);

      if (salienceDelta !== 0) {
        return salienceDelta;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, MAX_RECALL_CANDIDATES);
}

export function buildReplayTranscriptOrganization(
  turns: TranscriptTurn[],
  replayMetadata: Record<string, ReplayCommittedTurnMetadata>,
  options: BuildReplayTranscriptOrganizationOptions = {},
): TranscriptOrganizationSnapshot {
  const dossierLexicon = buildReplayDossierLexicon(options.handoff);
  const sourceMetadataByTurnId = turns.reduce<
    Record<string, TranscriptOrganizationSourceMetadata>
  >((result, turn, index) => {
    result[turn.id] = resolveTurnMetadata(
      turn,
      index > 0 ? turns[index - 1] ?? null : null,
      replayMetadata[turn.id],
      dossierLexicon,
    );
    return result;
  }, {});
  const annotations = turns.flatMap((turn) =>
    buildAnnotationsFromReplayMetadata(turn, sourceMetadataByTurnId[turn.id]),
  );
  const annotationsByTurnId = buildAnnotationsByTurnId(turns, annotations);
  const groupedAnnotations = buildGroupedAnnotations(annotations, turns);
  const completionDebt = buildTranscriptCompletionDebt(
    turns,
    sourceMetadataByTurnId,
    groupedAnnotations.groups
      .filter((group) => isDebtSourceKind(group.sourceKind))
      .flatMap((group) =>
        group.openedAtTurnId && group.lastSeenTurnId
          ? [
              {
                key: group.key,
                label: group.label,
                sourceKind:
                  group.sourceKind as Exclude<
                    TranscriptDerivedAnnotation["kind"],
                    "entity"
                  >,
                turnIds: group.turnIds,
                occurrenceCount: group.occurrenceCount,
                currentTurnLinked: group.currentTurnLinked,
                lastSeenTurnId: group.lastSeenTurnId,
                lastSeenAt: group.lastSeenAt,
                lastSeenIndex: group.lastSeenIndex,
                openedAtTurnId: group.openedAtTurnId,
                openedAtIndex: group.openedAtIndex,
              },
            ]
          : [],
      ),
  );
  const debtMap = toDebtMap(completionDebt);
  const emergingThemes = buildEmergingThemes(
    groupedAnnotations.groups,
    turns.length,
    debtMap,
  );
  const openThreads = buildOpenThreads(groupedAnnotations.groups, debtMap);
  const notableClaims = buildNotableClaims(groupedAnnotations.groups, debtMap);
  const tensionWatch = buildTensionWatch(groupedAnnotations.groups, debtMap);
  const currentTurnAnnotations = groupedAnnotations.currentTurnId
    ? annotationsByTurnId[groupedAnnotations.currentTurnId] ?? []
    : [];
  const currentTurnText = turns.at(-1)?.text ?? null;
  const recallCandidates = buildRecallCandidates(
    currentTurnAnnotations,
    currentTurnText,
    groupedAnnotations,
    emergingThemes,
    openThreads,
    notableClaims,
    tensionWatch,
    debtMap,
  );

  return {
    sessionId: turns[0]?.sessionId ?? null,
    sourceMetadataByTurnId,
    annotations,
    annotationsByTurnId,
    emergingThemes,
    openThreads,
    notableClaims,
    tensionWatch,
    completionDebt,
    recallCandidates,
    summary: {
      entities: collectUniqueLabels(annotations, "entity"),
      themes: collectUniqueLabels(annotations, "theme"),
      claims: collectUniqueLabels(annotations, "claim"),
      unresolvedThreadCues: collectUniqueLabels(annotations, "thread_cue"),
      tensions: collectUniqueLabels(annotations, "tension"),
    },
  };
}
