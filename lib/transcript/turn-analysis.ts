import type { TranscriptTurn } from "@/types";

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

export type ReplayTurnAnalysis = {
  turnKind: ReplayTurnKind;
  specificityBand: ReplaySpecificityBand;
  emotionalSignal: ReplayEmotionalSignal;
  threadAction: ReplayThreadAction;
  cuePotential: ReplayCuePotential;
};

function isQuestion(text: string) {
  return /\?$/.test(text) || /^(who|what|when|where|why|how|did|do|does|can|could|would|will)\b/i.test(text);
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

export function analyzeReplayCommittedTurn(
  turn: TranscriptTurn,
): ReplayTurnAnalysis {
  return {
    turnKind: getTurnKind(turn),
    specificityBand: getSpecificityBand(turn.specificityScore),
    emotionalSignal: getEmotionalSignal(turn),
    threadAction: getThreadAction(turn),
    cuePotential: getCuePotential(turn),
  };
}
