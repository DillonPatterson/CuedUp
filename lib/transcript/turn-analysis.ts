import type { TranscriptTurn } from "@/types";
import {
  scanReplayLexicalSignals,
  type ReplayDossierLexicon,
  type ReplayLexicalEmotionBucket,
  type ReplayLexicalHit,
  type ReplayLexicalTier,
} from "@/lib/transcript/lexical-tiers";

export type { ReplayDossierLexicon, ReplayLexicalHit, ReplayLexicalTier };

export type ReplayTurnKind =
  | "question"
  | "answer"
  | "producer_note"
  | "system_note"
  | "statement";

export type ReplaySpecificityBand = "low" | "medium" | "high";
export type ReplayEmotionalSignal = "flat" | "engaged" | "heated";
export type ReplayThreadAction =
  | "none"
  | "opens"
  | "revisits"
  | "linked"
  | "deflects";
export type ReplayCuePotential = "low" | "medium" | "high";
export type ReplayDominantEmotion =
  | "neutral"
  | ReplayLexicalEmotionBucket;
export type ReplayAffectiveIntensity = "low" | "medium" | "high";
export type ReplayValence = "negative" | "mixed" | "positive" | "neutral";
export type ReplayCompletionStatus =
  | "complete"
  | "incomplete"
  | "truncated"
  | "uncertain";
export type ReplayCompletionReason =
  | "endsWithConnector"
  | "danglingClause"
  | "explicitQuestionOpen"
  | "veryShortFragment"
  | "endsWithDash"
  | "endsWithEllipsis"
  | "noTerminalPunctuation";
export type ReplayInterruptionReason =
  | "unfinishedSpeakerSwitch"
  | "rapidSpeakerSwitch"
  | "nonIncreasingTimestamp"
  | "none";

export type ReplayTurnAnalysis = {
  turnKind: ReplayTurnKind;
  specificityBand: ReplaySpecificityBand;
  emotionalSignal: ReplayEmotionalSignal;
  threadAction: ReplayThreadAction;
  cuePotential: ReplayCuePotential;
  affective: {
    dominantEmotion: ReplayDominantEmotion;
    intensity: ReplayAffectiveIntensity;
    valence: ReplayValence;
    triggerTerms: ReplayLexicalHit[];
  };
  completion: {
    completionStatus: ReplayCompletionStatus;
    reasons: ReplayCompletionReason[];
  };
  interruption: {
    interruptedPreviousTurn: boolean;
    previousTurnId: string | null;
    reason: ReplayInterruptionReason;
  };
  lexical: {
    hits: ReplayLexicalHit[];
    weightedScore: number;
  };
};

type ReplayTurnAnalysisOptions = {
  previousTurn?: TranscriptTurn | null;
  dossierLexicon?: ReplayDossierLexicon | null;
};

const CONNECTOR_PATTERN = /\b(and|but|so|because|if|when|though|while)\s*$/i;
const OPEN_QUESTION_PATTERN = /^(whether|if|why|how|what changed)\b/i;
const TERMINAL_PUNCTUATION_PATTERN = /[.?!]$/;
const DASH_PATTERN = /[-—]\s*$/;
const ELLIPSIS_PATTERN = /(\.\.\.|…)\s*$/;
const DANGLING_CLAUSE_PATTERN = /[,:;]\s*$/;

function countTokens(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isQuestion(text: string) {
  return (
    /\?$/.test(text) ||
    /^(who|what|when|where|why|how|did|do|does|can|could|would|will)\b/i.test(
      text,
    )
  );
}

function getTurnKind(turn: TranscriptTurn): ReplayTurnKind {
  if (turn.speaker === "producer") {
    return "producer_note";
  }

  if (turn.speaker === "system") {
    return "system_note";
  }

  if (turn.speaker === "host" && isQuestion(turn.text)) {
    return "question";
  }

  if (turn.speaker === "guest") {
    return "answer";
  }

  return "statement";
}

function getSpecificityBand(value: number): ReplaySpecificityBand {
  if (value >= 0.7) {
    return "high";
  }

  if (value >= 0.4) {
    return "medium";
  }

  return "low";
}

function getEmotionalSignal(turn: TranscriptTurn): ReplayEmotionalSignal {
  if (turn.energyScore >= 0.75 || turn.evasionScore >= 0.7) {
    return "heated";
  }

  if (turn.energyScore >= 0.45) {
    return "engaged";
  }

  return "flat";
}

function getThreadAction(turn: TranscriptTurn): ReplayThreadAction {
  if (turn.threadIdLink) {
    return "linked";
  }

  if (turn.evasionScore >= 0.65) {
    return "deflects";
  }

  if (turn.noveltyScore >= 0.7 && turn.specificityScore >= 0.5) {
    return "opens";
  }

  if (turn.noveltyScore <= 0.3 && turn.specificityScore >= 0.5) {
    return "revisits";
  }

  return "none";
}

function getCuePotential(turn: TranscriptTurn): ReplayCuePotential {
  const cueScore =
    turn.specificityScore * 0.45 +
    turn.noveltyScore * 0.35 +
    (1 - turn.evasionScore) * 0.2;

  if (cueScore >= 0.7) {
    return "high";
  }

  if (cueScore >= 0.45) {
    return "medium";
  }

  return "low";
}

function getDominantEmotion(
  emotionScores: Record<ReplayLexicalEmotionBucket, number>,
): ReplayDominantEmotion {
  const rankedScores = Object.entries(emotionScores).sort(
    (left, right) => right[1] - left[1],
  );

  if (!rankedScores[0] || rankedScores[0][1] <= 0) {
    return "neutral";
  }

  return rankedScores[0][0] as ReplayDominantEmotion;
}

function getAffectiveIntensity(
  weightedScore: number,
  turn: TranscriptTurn,
): ReplayAffectiveIntensity {
  if (weightedScore >= 3 || turn.energyScore >= 0.75) {
    return "high";
  }

  if (weightedScore >= 1.5 || turn.energyScore >= 0.45) {
    return "medium";
  }

  return "low";
}

function getValence(
  negativeScore: number,
  positiveScore: number,
): ReplayValence {
  if (negativeScore >= 1 && positiveScore >= 1) {
    return "mixed";
  }

  if (negativeScore - positiveScore >= 1) {
    return "negative";
  }

  if (positiveScore - negativeScore >= 1) {
    return "positive";
  }

  return "neutral";
}

function analyzeCompletion(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const tokenCount = countTokens(normalizedText);
  const reasons = new Set<ReplayCompletionReason>();
  const hasTerminalPunctuation = TERMINAL_PUNCTUATION_PATTERN.test(normalizedText);

  if (DASH_PATTERN.test(normalizedText)) {
    reasons.add("endsWithDash");
  }

  if (ELLIPSIS_PATTERN.test(normalizedText)) {
    reasons.add("endsWithEllipsis");
  }

  if (!hasTerminalPunctuation) {
    reasons.add("noTerminalPunctuation");
  }

  if (tokenCount < 5 && !hasTerminalPunctuation) {
    reasons.add("veryShortFragment");
  }

  if (CONNECTOR_PATTERN.test(normalizedText)) {
    reasons.add("endsWithConnector");
  }

  if (DANGLING_CLAUSE_PATTERN.test(normalizedText)) {
    reasons.add("danglingClause");
  }

  if (OPEN_QUESTION_PATTERN.test(normalizedText) && !hasTerminalPunctuation) {
    reasons.add("explicitQuestionOpen");
  }

  let completionStatus: ReplayCompletionStatus = "complete";

  if (
    reasons.has("endsWithDash") ||
    reasons.has("endsWithEllipsis") ||
    reasons.has("veryShortFragment")
  ) {
    completionStatus = "truncated";
  } else if (
    reasons.has("endsWithConnector") ||
    reasons.has("danglingClause") ||
    reasons.has("explicitQuestionOpen")
  ) {
    completionStatus = "incomplete";
  } else if (!hasTerminalPunctuation && tokenCount >= 5 && tokenCount <= 8) {
    completionStatus = "uncertain";
  }

  return {
    completionStatus,
    reasons: Array.from(reasons),
  };
}

function analyzeInterruption(
  turn: TranscriptTurn,
  previousTurn: TranscriptTurn | null,
) {
  if (!previousTurn || previousTurn.speaker === turn.speaker) {
    return {
      interruptedPreviousTurn: false,
      previousTurnId: previousTurn?.id ?? null,
      reason: "none" as ReplayInterruptionReason,
    };
  }

  const previousCompletion = analyzeCompletion(previousTurn.text);
  const previousTurnIncomplete =
    previousCompletion.completionStatus === "incomplete" ||
    previousCompletion.completionStatus === "truncated";

  if (!previousTurnIncomplete) {
    return {
      interruptedPreviousTurn: false,
      previousTurnId: previousTurn.id,
      reason: "none" as ReplayInterruptionReason,
    };
  }

  const currentTimestamp = new Date(turn.timestamp).getTime();
  const previousTimestamp = new Date(previousTurn.timestamp).getTime();

  if (currentTimestamp <= previousTimestamp) {
    return {
      interruptedPreviousTurn: true,
      previousTurnId: previousTurn.id,
      reason: "nonIncreasingTimestamp" as ReplayInterruptionReason,
    };
  }

  if (currentTimestamp - previousTimestamp <= 2_000) {
    return {
      interruptedPreviousTurn: true,
      previousTurnId: previousTurn.id,
      reason: "rapidSpeakerSwitch" as ReplayInterruptionReason,
    };
  }

  return {
    interruptedPreviousTurn: true,
    previousTurnId: previousTurn.id,
    reason: "unfinishedSpeakerSwitch" as ReplayInterruptionReason,
  };
}

export function analyzeReplayCommittedTurn(
  turn: TranscriptTurn,
  options: ReplayTurnAnalysisOptions = {},
): ReplayTurnAnalysis {
  const lexicalScan = scanReplayLexicalSignals(turn.text, options.dossierLexicon);

  return {
    turnKind: getTurnKind(turn),
    specificityBand: getSpecificityBand(turn.specificityScore),
    emotionalSignal: getEmotionalSignal(turn),
    threadAction: getThreadAction(turn),
    cuePotential: getCuePotential(turn),
    affective: {
      dominantEmotion: getDominantEmotion(lexicalScan.emotionScores),
      intensity: getAffectiveIntensity(lexicalScan.weightedScore, turn),
      valence: getValence(lexicalScan.negativeScore, lexicalScan.positiveScore),
      triggerTerms: lexicalScan.hits,
    },
    completion: analyzeCompletion(turn.text),
    interruption: analyzeInterruption(turn, options.previousTurn ?? null),
    lexical: {
      hits: lexicalScan.hits,
      weightedScore: lexicalScan.weightedScore,
    },
  };
}
