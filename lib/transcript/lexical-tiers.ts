import type { DossierLiveHandoff } from "@/types";

export type ReplayLexicalTier =
  | "emotion"
  | "stakes"
  | "intensifier"
  | "deflection"
  | "dossier_story"
  | "dossier_live_wire"
  | "dossier_contradiction";

export type ReplayLexicalHit = {
  term: string;
  tier: ReplayLexicalTier;
  weight: number;
  source: "base" | "dossier";
};

export type ReplayDossierLexicon = {
  storyTerms: ReplayLexicalHit[];
  liveWireTerms: ReplayLexicalHit[];
  contradictionTerms: ReplayLexicalHit[];
};

export type ReplayLexicalEmotionBucket =
  | "regret"
  | "fear"
  | "anger"
  | "sadness"
  | "defensiveness";

export type ReplayLexicalScan = {
  hits: ReplayLexicalHit[];
  weightedScore: number;
  emotionScores: Record<ReplayLexicalEmotionBucket, number>;
  negativeScore: number;
  positiveScore: number;
  hasDeflection: boolean;
};

type LexicalEntry = ReplayLexicalHit & {
  normalizedTerm: string;
  emotionBuckets: ReplayLexicalEmotionBucket[];
  negativeWeight: number;
  positiveWeight: number;
};

const BASE_ENTRIES: LexicalEntry[] = [
  {
    term: "regret",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "regret",
    emotionBuckets: ["regret"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "fear",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "fear",
    emotionBuckets: ["fear"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "hurt",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "hurt",
    emotionBuckets: ["sadness"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "ashamed",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "ashamed",
    emotionBuckets: ["regret"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "personal",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "personal",
    emotionBuckets: ["sadness"],
    negativeWeight: 0.5,
    positiveWeight: 0.25,
  },
  {
    term: "trust",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "trust",
    emotionBuckets: ["regret"],
    negativeWeight: 0.5,
    positiveWeight: 1,
  },
  {
    term: "loss",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "loss",
    emotionBuckets: ["sadness"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "relapse",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "relapse",
    emotionBuckets: ["sadness", "fear"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "grief",
    tier: "emotion",
    weight: 1,
    source: "base",
    normalizedTerm: "grief",
    emotionBuckets: ["sadness"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "risk",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "risk",
    emotionBuckets: ["fear"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "downside",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "downside",
    emotionBuckets: ["fear"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "layoffs",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "layoffs",
    emotionBuckets: ["sadness"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "board",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "board",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.5,
    positiveWeight: 0,
  },
  {
    term: "mission",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "mission",
    emotionBuckets: [],
    negativeWeight: 0,
    positiveWeight: 1,
  },
  {
    term: "accountability",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "accountability",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 1,
    positiveWeight: 0,
  },
  {
    term: "family",
    tier: "stakes",
    weight: 1,
    source: "base",
    normalizedTerm: "family",
    emotionBuckets: ["sadness"],
    negativeWeight: 0.5,
    positiveWeight: 1,
  },
  {
    term: "very",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "very",
    emotionBuckets: [],
    negativeWeight: 0,
    positiveWeight: 0,
  },
  {
    term: "really",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "really",
    emotionBuckets: [],
    negativeWeight: 0,
    positiveWeight: 0,
  },
  {
    term: "deeply",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "deeply",
    emotionBuckets: [],
    negativeWeight: 0,
    positiveWeight: 0,
  },
  {
    term: "never",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "never",
    emotionBuckets: [],
    negativeWeight: 0.25,
    positiveWeight: 0,
  },
  {
    term: "always",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "always",
    emotionBuckets: [],
    negativeWeight: 0,
    positiveWeight: 0,
  },
  {
    term: "only",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "only",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.25,
    positiveWeight: 0,
  },
  {
    term: "just",
    tier: "intensifier",
    weight: 0.5,
    source: "base",
    normalizedTerm: "just",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.25,
    positiveWeight: 0,
  },
  {
    term: "maybe",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "maybe",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "kind of",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "kind of",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "sort of",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "sort of",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "i guess",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "i guess",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "probably",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "probably",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "hard to say",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "hard to say",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "depends",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "depends",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
  {
    term: "complicated",
    tier: "deflection",
    weight: 0.75,
    source: "base",
    normalizedTerm: "complicated",
    emotionBuckets: ["defensiveness"],
    negativeWeight: 0.75,
    positiveWeight: 0,
  },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function uniqueTerms(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = normalizeText(value);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function buildLexicalEntry(
  term: string,
  tier: ReplayLexicalTier,
  weight: number,
): LexicalEntry {
  return {
    term,
    tier,
    weight,
    source: "dossier",
    normalizedTerm: normalizeText(term),
    emotionBuckets: tier === "dossier_live_wire" ? ["fear"] : [],
    negativeWeight:
      tier === "dossier_live_wire" || tier === "dossier_contradiction"
        ? weight
        : 0.25,
    positiveWeight: tier === "dossier_story" ? 0.5 : 0,
  };
}

function buildWeightedTerms(
  values: string[],
  tier: ReplayLexicalTier,
  weight: number,
) {
  return uniqueTerms(values).map((term) => ({
    term,
    tier,
    weight,
    source: "dossier" as const,
  }));
}

function buildDossierTerms(values: string[]) {
  return uniqueTerms([
    ...values,
    ...values.flatMap((value) => tokenize(value)),
  ]);
}

function matchesEntry(
  normalizedText: string,
  tokens: Set<string>,
  entry: LexicalEntry,
) {
  if (entry.normalizedTerm.includes(" ")) {
    return normalizedText.includes(entry.normalizedTerm);
  }

  return entry.normalizedTerm.length >= 4 && tokens.has(entry.normalizedTerm);
}

export function buildReplayDossierLexicon(
  handoff: DossierLiveHandoff | null | undefined,
): ReplayDossierLexicon | null {
  if (!handoff) {
    return null;
  }

  return {
    storyTerms: buildWeightedTerms(
      buildDossierTerms(
        handoff.activeStoryVeins.flatMap((vein) => [vein.title, vein.theme]),
      ),
      "dossier_story",
      1.1,
    ),
    liveWireTerms: buildWeightedTerms(
      buildDossierTerms(
        handoff.liveWires.flatMap((wire) => [wire.label, ...wire.triggerPhrases]),
      ),
      "dossier_live_wire",
      1.5,
    ),
    contradictionTerms: buildWeightedTerms(
      buildDossierTerms(
        handoff.contradictionCandidates.flatMap((item) => [
          item.topic,
          item.statementA,
          item.statementB,
        ]),
      ),
      "dossier_contradiction",
      1.25,
    ),
  };
}

export function scanReplayLexicalSignals(
  text: string,
  dossierLexicon?: ReplayDossierLexicon | null,
): ReplayLexicalScan {
  const normalizedText = normalizeText(text);
  const tokens = new Set(tokenize(text));
  const dossierEntries = [
    ...(dossierLexicon?.storyTerms ?? []),
    ...(dossierLexicon?.liveWireTerms ?? []),
    ...(dossierLexicon?.contradictionTerms ?? []),
  ].map((entry) => buildLexicalEntry(entry.term, entry.tier, entry.weight));
  const matchedEntries = [...BASE_ENTRIES, ...dossierEntries].filter((entry) =>
    matchesEntry(normalizedText, tokens, entry),
  );
  const dedupedEntries = Array.from(
    matchedEntries.reduce<Map<string, LexicalEntry>>((result, entry) => {
      const current = result.get(entry.normalizedTerm);

      if (!current || entry.weight > current.weight) {
        result.set(entry.normalizedTerm, entry);
      }

      return result;
    }, new Map()),
  ).map((entry) => entry[1]);

  return dedupedEntries.reduce<ReplayLexicalScan>(
    (result, entry) => {
      entry.emotionBuckets.forEach((bucket) => {
        result.emotionScores[bucket] += entry.weight;
      });
      result.hits.push({
        term: entry.term,
        tier: entry.tier,
        weight: entry.weight,
        source: entry.source,
      });
      result.weightedScore += entry.weight;
      result.negativeScore += entry.negativeWeight;
      result.positiveScore += entry.positiveWeight;
      result.hasDeflection ||= entry.tier === "deflection";
      return result;
    },
    {
      hits: [],
      weightedScore: 0,
      emotionScores: {
        regret: 0,
        fear: 0,
        anger: 0,
        sadness: 0,
        defensiveness: 0,
      },
      negativeScore: 0,
      positiveScore: 0,
      hasDeflection: false,
    },
  );
}
