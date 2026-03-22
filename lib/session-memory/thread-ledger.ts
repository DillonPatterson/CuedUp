import {
  type CanonicalTurn,
  sessionThreadSchema,
  threadMentionSchema,
  type SessionThread,
  type ThreadMention,
} from "@/lib/session-memory/contracts";
import { buildDebugTranscriptTurn } from "@/lib/session-memory/transcript-adapter";
import { analyzeReplayCommittedTurn } from "@/lib/transcript/turn-analysis";
import { extractReplayTurnMemory } from "@/lib/transcript/turn-memory";

const RESOLUTION_PHRASES = [
  "what changed was",
  "the answer is",
  "in the end",
  "so the point is",
  "that was the point",
  "that is the point",
  "that's why",
];

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildThreadKey(
  mentionKind: ThreadMention["mentionKind"],
  label: string,
) {
  return `${mentionKind}:${normalizeSearchText(label)}`;
}

function hasResolutionLanguage(value: string) {
  const normalized = normalizeSearchText(value);

  return RESOLUTION_PHRASES.some((phrase) => normalized.includes(phrase));
}

function affectiveRank(value: SessionThread["affectiveWeight"]) {
  switch (value) {
    case "high":
      return 2;
    case "medium":
      return 1;
    default:
      return 0;
  }
}

function buildMentionRecords(
  sessionId: string,
  canonicalTurn: CanonicalTurn,
  previousTurn: CanonicalTurn | null,
) {
  const transcriptTurn = buildDebugTranscriptTurn(canonicalTurn);
  const previousTranscriptTurn = previousTurn
    ? buildDebugTranscriptTurn(previousTurn)
    : null;
  const analysis = analyzeReplayCommittedTurn(transcriptTurn, {
    previousTurn: previousTranscriptTurn,
  });
  const memory = extractReplayTurnMemory(transcriptTurn, analysis);
  const nextMentions: ThreadMention[] = [];
  const mentionLabels = [
    ...memory.themes.map((label) => ({
      mentionKind: "theme" as const,
      label,
    })),
    ...memory.claims.map((label) => ({
      mentionKind: "claim" as const,
      label,
    })),
    ...memory.unresolvedThreadCues.map((label) => ({
      mentionKind: "thread_cue" as const,
      label,
    })),
    ...memory.contradictionSignals.map((label) => ({
      mentionKind: "tension" as const,
      label,
    })),
  ];

  mentionLabels.forEach(({ mentionKind, label }, index) => {
    nextMentions.push(
      threadMentionSchema.parse({
        id: `${canonicalTurn.id}:${mentionKind}:${index}`,
        sessionId,
        threadKey: buildThreadKey(mentionKind, label),
        label,
        mentionKind,
        turnId: canonicalTurn.id,
        turnSequence: canonicalTurn.sequence,
        excerpt: canonicalTurn.text,
        salience: memory.salience,
        createdAt: canonicalTurn.finalizedAt,
      }),
    );
  });

  return {
    mentions: nextMentions,
    analysis,
  };
}

export function buildThreadMentions(canonicalTurns: CanonicalTurn[]) {
  const mentions: ThreadMention[] = [];
  const analysisByTurnId: Record<
    string,
    ReturnType<typeof analyzeReplayCommittedTurn>
  > = {};

  canonicalTurns.forEach((turn, index) => {
    const previousTurn = index > 0 ? canonicalTurns[index - 1] ?? null : null;
    const result = buildMentionRecords(turn.sessionId, turn, previousTurn);

    mentions.push(...result.mentions);
    analysisByTurnId[turn.id] = result.analysis;
  });

  return {
    mentions,
    analysisByTurnId,
  };
}

export function buildSessionThreads(
  sessionId: string,
  canonicalTurns: CanonicalTurn[],
  mentions: ThreadMention[],
  analysisByTurnId: Record<string, ReturnType<typeof analyzeReplayCommittedTurn>>,
) {
  const turnById = canonicalTurns.reduce<Record<string, CanonicalTurn>>((result, turn) => {
    result[turn.id] = turn;
    return result;
  }, {});
  const currentSequence = canonicalTurns.at(-1)?.sequence ?? 0;
  const groupedMentions = new Map<string, ThreadMention[]>();

  mentions.forEach((mention) => {
    const existing = groupedMentions.get(mention.threadKey) ?? [];

    existing.push(mention);
    groupedMentions.set(mention.threadKey, existing);
  });

  return Array.from(groupedMentions.entries())
    .map(([threadKey, threadMentions]) => {
      const sortedMentions = [...threadMentions].sort(
        (left, right) => left.turnSequence - right.turnSequence,
      );
      const firstMention = sortedMentions[0]!;
      const lastMention = sortedMentions.at(-1)!;
      const latestTurn = turnById[lastMention.turnId]!;
      const latestAnalysis = analysisByTurnId[lastMention.turnId];
      const turnsSinceLastMention = Math.max(
        0,
        currentSequence - lastMention.turnSequence,
      );
      const resolved = hasResolutionLanguage(latestTurn.text);
      const status: SessionThread["status"] = resolved
        ? turnsSinceLastMention <= 2
          ? "cooling"
          : "resolved"
        : "open";

      let debtScore =
        Math.min(6, sortedMentions.length) +
        affectiveRank(latestAnalysis?.affective.intensity ?? "low") +
        (latestAnalysis?.completion.completionStatus === "truncated"
          ? 2
          : latestAnalysis?.completion.completionStatus === "incomplete"
            ? 1
            : 0) +
        (latestAnalysis?.interruption.interruptedPreviousTurn ? 1 : 0) +
        (status === "open" && turnsSinceLastMention >= 2 ? 1 : 0);

      if (status !== "open") {
        debtScore = Math.max(0, debtScore - 3);
      }

      return sessionThreadSchema.parse({
        sessionId,
        threadKey,
        label: lastMention.label,
        sourceKind: lastMention.mentionKind,
        status,
        debtScore: Math.max(0, Math.min(10, debtScore)),
        dropScore:
          status === "open"
            ? turnsSinceLastMention * 2 + Math.max(0, Math.min(10, debtScore))
            : 0,
        mentionTurnIds: sortedMentions.map((mention) => mention.turnId),
        mentionCount: sortedMentions.length,
        openedAtTurnId: firstMention.turnId,
        lastMentionTurnId: lastMention.turnId,
        lastMentionAt: lastMention.createdAt,
        resolutionConfidence: status === "open" ? 0.1 : 0.8,
        interrupted: latestAnalysis?.interruption.interruptedPreviousTurn ?? false,
        affectiveWeight: latestAnalysis?.affective.intensity ?? "low",
      });
    })
    .sort((left, right) => right.dropScore - left.dropScore);
}
