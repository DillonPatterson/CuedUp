import type {
  CandidateNextMove,
  ConversationState,
  TranscriptTurn,
} from "@/types";
import { formatCandidateCue } from "@/lib/live/cue-formatter";

export const suppressionReasonValues = [
  "cooldown",
  "repetition",
  "host_already_covered",
  "stale",
  "below_confidence_floor",
  "format_invalid",
  "no_candidate",
] as const;

export type SuppressionReason = (typeof suppressionReasonValues)[number];
export type PresenceGuardOutcome = "surfaced" | "suppressed" | "none";

export type SurfaceCue = {
  id: string;
  text: string;
  timestamp: string;
  candidateId: string;
  sourceTurnId: string | null;
  threadId: string | null;
};

export type PresenceGuardDecision = {
  outcome: PresenceGuardOutcome;
  reasons: SuppressionReason[];
  candidateId: string | null;
  candidateLabel: string | null;
  formattedCue: string | null;
  sourceTurnId: string | null;
  timestamp: string;
};

type PresenceGuardContext = {
  state: ConversationState;
  currentTurn: TranscriptTurn | null;
  recentTurns: TranscriptTurn[];
  surfacedCueHistory: SurfaceCue[];
};

type PresenceGuardResult = {
  surfaceCue: SurfaceCue | null;
  decisionLogEntry: PresenceGuardDecision;
  guardDecisions: PresenceGuardDecision[];
};

const CUE_COOLDOWN_MS = 45_000;
const STALE_CONTENT_MS = 180_000;
const HOST_LOOKBACK_MS = 300_000;
const CONFIDENCE_FLOOR = 0.6;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(" ").filter((token) => token.length >= 3);
}

function keywordOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let sharedCount = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      sharedCount += 1;
    }
  }

  return sharedCount / Math.max(leftTokens.size, rightTokens.size);
}

function millisecondsBetween(left: string, right: string) {
  return Math.abs(new Date(left).getTime() - new Date(right).getTime());
}

function buildDecision(
  outcome: PresenceGuardOutcome,
  reasons: SuppressionReason[],
  candidate: CandidateNextMove | null,
  formattedCue: string | null,
  timestamp: string,
  sourceTurnId: string | null,
): PresenceGuardDecision {
  return {
    outcome,
    reasons,
    candidateId: candidate?.id ?? null,
    candidateLabel: candidate?.label ?? null,
    formattedCue,
    sourceTurnId,
    timestamp,
  };
}

function hasRecentHostCoverage(
  candidate: CandidateNextMove,
  formattedCue: string,
  context: PresenceGuardContext,
) {
  const currentTimestamp = context.currentTurn?.timestamp ?? context.state.updatedAt;
  const recentHostTurns = context.recentTurns.filter((turn) => {
    if (turn.speaker !== "host") {
      return false;
    }

    return millisecondsBetween(turn.timestamp, currentTimestamp) <= HOST_LOOKBACK_MS;
  });

  if (
    candidate.threadId &&
    recentHostTurns.some((turn) => turn.threadIdLink === candidate.threadId)
  ) {
    return true;
  }

  return recentHostTurns.some(
    (turn) => keywordOverlap(turn.text, formattedCue) > 0.5,
  );
}

function isCueStale(candidate: CandidateNextMove, context: PresenceGuardContext) {
  if (!candidate.threadId) {
    return false;
  }

  const relatedThread = context.state.threads.find((thread) => thread.id === candidate.threadId);

  if (!relatedThread?.lastTouchedAt) {
    return false;
  }

  if (relatedThread.status === "active") {
    return false;
  }

  const currentTimestamp = context.currentTurn?.timestamp ?? context.state.updatedAt;

  return (
    millisecondsBetween(relatedThread.lastTouchedAt, currentTimestamp) > STALE_CONTENT_MS
  );
}

function isRepeatedCue(formattedCue: string, history: SurfaceCue[]) {
  return history
    .slice(-2)
    .some((cue) => keywordOverlap(cue.text, formattedCue) > 0.5);
}

function isWithinCooldown(history: SurfaceCue[], timestamp: string) {
  const lastCue = history.at(-1);

  if (!lastCue) {
    return false;
  }

  return millisecondsBetween(lastCue.timestamp, timestamp) < CUE_COOLDOWN_MS;
}

export function evaluatePresenceGuard(
  candidateMoves: CandidateNextMove[],
  context: PresenceGuardContext,
): PresenceGuardResult {
  const timestamp = context.currentTurn?.timestamp ?? context.state.updatedAt;
  const sourceTurnId = context.currentTurn?.id ?? null;

  if (candidateMoves.length === 0) {
    const decision = buildDecision(
      "none",
      ["no_candidate"],
      null,
      null,
      timestamp,
      sourceTurnId,
    );

    return {
      surfaceCue: null,
      decisionLogEntry: decision,
      guardDecisions: [decision],
    };
  }

  const guardDecisions: PresenceGuardDecision[] = [];

  for (const candidate of candidateMoves) {
    const reasons: SuppressionReason[] = [];
    const formattedCue = formatCandidateCue(candidate);

    if (!formattedCue) {
      reasons.push("format_invalid");
    }

    if (candidate.priority < CONFIDENCE_FLOOR) {
      reasons.push("below_confidence_floor");
    }

    if (formattedCue && isWithinCooldown(context.surfacedCueHistory, timestamp)) {
      reasons.push("cooldown");
    }

    if (formattedCue && isRepeatedCue(formattedCue, context.surfacedCueHistory)) {
      reasons.push("repetition");
    }

    if (
      formattedCue &&
      hasRecentHostCoverage(candidate, formattedCue, context)
    ) {
      reasons.push("host_already_covered");
    }

    if (isCueStale(candidate, context)) {
      reasons.push("stale");
    }

    const uniqueReasons = Array.from(new Set(reasons));

    if (uniqueReasons.length > 0) {
      guardDecisions.push(
        buildDecision(
          "suppressed",
          uniqueReasons,
          candidate,
          formattedCue,
          timestamp,
          sourceTurnId,
        ),
      );
      continue;
    }

    if (!formattedCue) {
      guardDecisions.push(
        buildDecision(
          "suppressed",
          ["format_invalid"],
          candidate,
          null,
          timestamp,
          sourceTurnId,
        ),
      );
      continue;
    }

    const surfaceCue: SurfaceCue = {
      id: `${candidate.id}:${timestamp}`,
      text: formattedCue,
      timestamp,
      candidateId: candidate.id,
      sourceTurnId,
      threadId: candidate.threadId,
    };
    const surfacedDecision = buildDecision(
      "surfaced",
      [],
      candidate,
      formattedCue,
      timestamp,
      sourceTurnId,
    );

    return {
      surfaceCue,
      decisionLogEntry: surfacedDecision,
      guardDecisions: [...guardDecisions, surfacedDecision],
    };
  }

  const fallbackDecision =
    guardDecisions[0] ??
    buildDecision(
      "none",
      ["no_candidate"],
      null,
      null,
      timestamp,
      sourceTurnId,
    );

  return {
    surfaceCue: null,
    decisionLogEntry: fallbackDecision,
    guardDecisions,
  };
}
