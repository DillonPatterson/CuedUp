import type { TranscriptTurn } from "@/types";
import type { ReplayTurnAnalysis } from "@/lib/transcript/turn-analysis";

export type ReplayMemorySalience = "low" | "medium" | "high";
export type ReplayMemoryKind =
  | "fact"
  | "emotion"
  | "relationship"
  | "risk"
  | "identity"
  | "none";

export type ReplayTurnMemory = {
  entities: string[];
  themes: string[];
  claims: string[];
  contradictionSignals: string[];
  unresolvedThreadCues: string[];
  salience: ReplayMemorySalience;
  memoryKind: ReplayMemoryKind;
};

const entityPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "Brother", pattern: /\bbrother(?:'s)?\b/i },
  { label: "Family", pattern: /\bfamily\b/i },
  { label: "Board", pattern: /\bboard\b/i },
  { label: "Employees", pattern: /\bemployees?\b|\bworkers?\b|\bplant teams?\b/i },
  { label: "Nevada", pattern: /\bnevada\b/i },
  { label: "Factory town", pattern: /\bfactory town\b|\bmill\b/i },
  { label: "Investors", pattern: /\binvestors?\b/i },
  { label: "Leadership", pattern: /\bleadership\b/i },
  { label: "Mission", pattern: /\bmission\b/i },
];

const themePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "trust", pattern: /\btrust\b|\bcandor\b|\bsilence\b/i },
  { label: "risk", pattern: /\brisk\b|\bdownside\b|\bfragility\b/i },
  {
    label: "accountability",
    pattern: /\baccountability\b|\byes or no\b|\bwho exactly\b/i,
  },
  { label: "family", pattern: /\bbrother\b|\bfamily\b|\brelapse\b/i },
  {
    label: "mission",
    pattern: /\bmission\b|\bpublic company\b|\bpublic markets?\b/i,
  },
  {
    label: "restructuring",
    pattern: /\brestructuring\b|\blayoffs?\b|\bplant\b|\bboard\b/i,
  },
  {
    label: "repetition",
    pattern: /\brepeating?\b|\bsame thing\b|\bsaturated\b|\bplateau\b/i,
  },
  {
    label: "emotion",
    pattern: /\bregret\b|\bpersonal\b|\bhurt\b|\bfeel\b|\bresisted\b/i,
  },
];

function uniqueLabels(values: string[]) {
  return Array.from(new Set(values));
}

function collectLabels(
  text: string,
  patterns: Array<{ label: string; pattern: RegExp }>,
) {
  return uniqueLabels(
    patterns
      .filter(({ pattern }) => pattern.test(text))
      .map(({ label }) => label),
  );
}

function buildClaims(
  turn: TranscriptTurn,
  analysis: ReplayTurnAnalysis,
) {
  if (
    analysis.turnKind === "question" ||
    analysis.turnKind === "producer_note" ||
    analysis.turnKind === "system_note"
  ) {
    return [];
  }

  const normalizedText = turn.text.replace(/\s+/g, " ").trim();

  if (normalizedText.length < 12) {
    return [];
  }

  if (
    turn.specificityScore < 0.45 &&
    analysis.emotionalSignal === "flat" &&
    !/\b(regret|personal|trust|risk|relapse)\b/i.test(normalizedText)
  ) {
    return [];
  }

  return [normalizedText];
}

function buildContradictionSignals(
  text: string,
  turn: TranscriptTurn,
  analysis: ReplayTurnAnalysis,
) {
  const signals: string[] = [];

  if (turn.evasionScore >= 0.65 || analysis.threadAction === "deflects") {
    signals.push("evasion_pressure");
  }

  if (/\b(changed my mind|reversed|instead|used to|no longer)\b/i.test(text)) {
    signals.push("reversal_language");
  }

  if (/\b(but|still|yet|however)\b/i.test(text)) {
    signals.push("tension_language");
  }

  if (/\b(yes or no|what changed|who exactly|accountability)\b/i.test(text)) {
    signals.push("accountability_pressure");
  }

  if (/\b(regret|resisted saying)\b/i.test(text)) {
    signals.push("concession_language");
  }

  return uniqueLabels(signals);
}

function buildUnresolvedThreadCues(
  turn: TranscriptTurn,
  analysis: ReplayTurnAnalysis,
) {
  const cues: string[] = [];

  if (turn.threadIdLink) {
    cues.push("linked_thread");
  }

  if (analysis.threadAction === "opens") {
    cues.push("opens_thread");
  }

  if (analysis.threadAction === "revisits") {
    cues.push("revisits_thread");
  }

  if (analysis.threadAction === "deflects") {
    cues.push("deflects_thread");
  }

  return uniqueLabels(cues);
}

function getSalience(
  turn: TranscriptTurn,
  entities: string[],
  themes: string[],
  contradictionSignals: string[],
  analysis: ReplayTurnAnalysis,
): ReplayMemorySalience {
  const salienceScore =
    turn.specificityScore * 0.35 +
    turn.energyScore * 0.25 +
    turn.noveltyScore * 0.15 +
    (contradictionSignals.length > 0 ? 0.15 : 0) +
    (entities.length > 0 ? 0.05 : 0) +
    (themes.length > 0 ? 0.05 : 0);

  if (
    analysis.emotionalSignal === "heated" ||
    contradictionSignals.includes("accountability_pressure")
  ) {
    return "high";
  }

  if (salienceScore >= 0.75) {
    return "high";
  }

  if (salienceScore >= 0.45) {
    return "medium";
  }

  return "low";
}

function getMemoryKind(
  text: string,
  entities: string[],
  themes: string[],
  claims: string[],
  analysis: ReplayTurnAnalysis,
): ReplayMemoryKind {
  if (entities.includes("Brother") || entities.includes("Family") || themes.includes("family")) {
    return "relationship";
  }

  if (
    themes.includes("emotion") ||
    (analysis.emotionalSignal !== "flat" &&
      /\b(feel|felt|personal|regret|resisted|relapse)\b/i.test(text))
  ) {
    return "emotion";
  }

  if (
    themes.includes("risk") ||
    themes.includes("trust") ||
    themes.includes("accountability") ||
    themes.includes("restructuring")
  ) {
    return "risk";
  }

  if (
    themes.includes("mission") ||
    /\b(i am|i was|who i|leadership|mission|identity)\b/i.test(text)
  ) {
    return "identity";
  }

  if (claims.length > 0) {
    return "fact";
  }

  return "none";
}

export function extractReplayTurnMemory(
  turn: TranscriptTurn,
  analysis: ReplayTurnAnalysis,
): ReplayTurnMemory {
  const normalizedText = turn.text.replace(/\s+/g, " ").trim();
  const entities = collectLabels(normalizedText, entityPatterns);
  const themes = collectLabels(normalizedText, themePatterns);
  const claims = buildClaims(turn, analysis);
  const contradictionSignals = buildContradictionSignals(
    normalizedText,
    turn,
    analysis,
  );
  const unresolvedThreadCues = buildUnresolvedThreadCues(turn, analysis);

  return {
    entities,
    themes,
    claims,
    contradictionSignals,
    unresolvedThreadCues,
    salience: getSalience(
      turn,
      entities,
      themes,
      contradictionSignals,
      analysis,
    ),
    memoryKind: getMemoryKind(
      normalizedText,
      entities,
      themes,
      claims,
      analysis,
    ),
  };
}
