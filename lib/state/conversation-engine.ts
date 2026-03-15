import type { DossierLiveHandoff } from "@/lib/state/dossier-handoff";
import type {
  CandidateNextMove,
  CandidateNextMoveType,
  ConversationMode,
  ConversationState,
  ConversationThread,
  FollowUpOpportunity,
  TranscriptTurn,
} from "@/types";

const SEEDED_STATE_TIMESTAMP = "2026-03-14T00:00:00.000Z";
const COVERED_VEIN_THRESHOLD = 0.45;
const RESOLVED_THREAD_THRESHOLD = 0.78;
const RECENT_NUDGE_WINDOW = 6;
const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "almost",
  "around",
  "because",
  "being",
  "between",
  "could",
  "every",
  "first",
  "from",
  "have",
  "into",
  "later",
  "never",
  "said",
  "that",
  "their",
  "them",
  "they",
  "this",
  "what",
  "when",
  "with",
  "would",
]);

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function scoreThreadMatch(text: string, keywords: string[]) {
  const normalizedText = normalizeText(text);

  return keywords.reduce((score, keyword) => {
    if (!keyword) {
      return score;
    }

    return normalizedText.includes(keyword) ? score + (keyword.includes(" ") ? 2 : 1) : score;
  }, 0);
}

function deriveStoryVeinKeywords(handoff: DossierLiveHandoff) {
  return handoff.activeStoryVeins.map((vein) => ({
    id: vein.id,
    label: vein.title,
    source: "story_vein" as const,
    relatedVeinId: vein.id,
    keywords: uniqueStrings([
      vein.title,
      vein.theme,
      ...tokenize(vein.title),
      ...tokenize(vein.summary),
      ...vein.suggestedEntryPoints,
      ...vein.suggestedFollowUps,
    ]),
  }));
}

function deriveLiveWireKeywords(handoff: DossierLiveHandoff) {
  return handoff.liveWires.map((wire) => ({
    id: wire.id,
    label: wire.label,
    source: "live_wire" as const,
    relatedVeinId: null,
    keywords: uniqueStrings([
      wire.label,
      wire.whyItMatters,
      ...wire.triggerPhrases,
      ...tokenize(wire.label),
      ...tokenize(wire.whyItMatters),
    ]),
  }));
}

function deriveContradictionKeywords(handoff: DossierLiveHandoff) {
  return handoff.contradictionCandidates.map((item) => ({
    id: item.id,
    label: item.topic,
    source: "contradiction" as const,
    relatedVeinId: null,
    keywords: uniqueStrings([
      item.topic,
      item.statementA,
      item.statementB,
      ...tokenize(item.topic),
      ...tokenize(item.statementA),
      ...tokenize(item.statementB),
    ]),
  }));
}

function createSeedThread(
  thread: Pick<
    ConversationThread,
    "id" | "label" | "source" | "relatedVeinId" | "keywords"
  >,
): ConversationThread {
  return {
    ...thread,
    status: "seeded",
    saturation: 0,
    touchCount: 0,
    lastTouchedAt: null,
    lastSpeaker: null,
  };
}

function getThreadIdsByStatus(threads: ConversationThread[]) {
  return threads.filter((thread) => thread.status !== "resolved").map((thread) => thread.id);
}

function computeSaturationDelta(
  turn: TranscriptTurn,
  thread: ConversationThread,
) {
  let delta =
    0.08 +
    turn.specificityScore * 0.18 +
    turn.energyScore * 0.12 -
    turn.evasionScore * 0.1;

  if (thread.source === "contradiction") {
    delta += 0.06;
  }

  if (thread.source === "live_wire") {
    delta += turn.energyScore * 0.06;
  }

  if (thread.touchCount > 0 && turn.noveltyScore < 0.4) {
    delta -= 0.06;
  }

  return clamp(delta, 0.02, 0.35);
}

function deriveThreadStatus(
  previousThread: ConversationThread,
  matched: boolean,
  turn: TranscriptTurn,
  nextSaturation: number,
): ConversationThread["status"] {
  if (previousThread.status === "resolved" && matched) {
    if (turn.specificityScore >= 0.75 && turn.noveltyScore >= 0.55) {
      return "active";
    }

    return "resolved";
  }

  if (
    matched &&
    nextSaturation >= RESOLVED_THREAD_THRESHOLD &&
    turn.specificityScore >= 0.6 &&
    turn.evasionScore <= 0.35
  ) {
    return "resolved";
  }

  if (matched) {
    return "active";
  }

  if (previousThread.status === "resolved") {
    return "resolved";
  }

  if (previousThread.touchCount === 0) {
    return "seeded";
  }

  return "cooling";
}

function buildPromptFragment(
  type: CandidateNextMoveType,
  handoff: DossierLiveHandoff,
  threadId: string | null,
): string | null {
  if (!threadId) {
    return null;
  }

  if (type === "press_contradiction") {
    return (
      handoff.contradictionCandidates.find((item) => item.id === threadId)
        ?.suggestedFollowUp ?? null
    );
  }

  if (type === "probe_live_wire") {
    return (
      handoff.liveWires.find((item) => item.id === threadId)?.suggestedApproach ?? null
    );
  }

  if (type === "open_vein") {
    return (
      handoff.activeStoryVeins.find((item) => item.id === threadId)
        ?.suggestedEntryPoints[0] ?? null
    );
  }

  return null;
}

function buildMove(
  id: string,
  type: CandidateNextMoveType,
  threadId: string | null,
  label: string,
  reason: string,
  priority: number,
  promptFragment: string | null,
): CandidateNextMove {
  return {
    id,
    type,
    threadId,
    label,
    reason,
    priority: clamp(priority),
    promptFragment,
  };
}

export function buildStableMoveKey(move: CandidateNextMove) {
  return `${move.type}:${move.threadId ?? move.label.toLowerCase()}`;
}

function deriveConversationMode(
  state: ConversationState,
  handoff: DossierLiveHandoff,
): ConversationMode {
  const openContradiction = state.threads.some(
    (thread) =>
      thread.source === "contradiction" &&
      thread.status !== "resolved" &&
      thread.saturation >= 0.4,
  );
  const totalStoryVeins = Math.max(handoff.activeStoryVeins.length, 1);

  if (state.closureConfidence >= 0.8) {
    return "wrap";
  }

  if (openContradiction || state.emotionalHeat >= 0.65) {
    return "challenge";
  }

  if (
    state.coveredVeins.length >= Math.max(1, totalStoryVeins - 1) ||
    state.turnCount >= 4
  ) {
    return "tighten";
  }

  return "explore";
}

export function seedConversationStateFromDossier(
  sessionId: string,
  handoff: DossierLiveHandoff,
): ConversationState {
  const threads = [
    ...deriveStoryVeinKeywords(handoff),
    ...deriveLiveWireKeywords(handoff),
    ...deriveContradictionKeywords(handoff),
  ].map((thread) => createSeedThread(thread));

  const seededState: ConversationState = {
    id: sessionId,
    sessionId,
    coveredVeins: [],
    activeThreads: getThreadIdsByStatus(threads),
    emotionalHeat: handoff.liveWires.length > 0 ? 0.2 : 0.1,
    closureConfidence: 0,
    currentMode: "explore",
    threads,
    candidateNextMoves: [],
    recentNudgeKeys: [],
    lastProcessedTurnId: null,
    turnCount: 0,
    lastMeaningfulShiftAt: null,
    staleNudgeGuard: false,
    updatedAt: SEEDED_STATE_TIMESTAMP,
  };

  return {
    ...seededState,
    candidateNextMoves: buildCandidateNextMoves(seededState, handoff),
  };
}

export function matchTurnToThreads(
  turn: TranscriptTurn,
  state: ConversationState,
): ConversationThread[] {
  const directMatches =
    turn.threadIdLink === null
      ? []
      : state.threads.filter((thread) => thread.id === turn.threadIdLink);

  const scoredMatches = state.threads
    .map((thread) => ({
      thread,
      score: scoreThreadMatch(turn.text, thread.keywords),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.thread);

  return Array.from(
    new Map([...directMatches, ...scoredMatches].map((thread) => [thread.id, thread])).values(),
  );
}

export function updateTopicCoverage(
  state: ConversationState,
  coveredVeins: string[],
): ConversationState {
  return {
    ...state,
    coveredVeins: Array.from(new Set([...state.coveredVeins, ...coveredVeins])),
  };
}

export function markVeinAsOpened(
  state: ConversationState,
  veinId: string,
): ConversationState {
  return updateTopicCoverage(state, [veinId]);
}

export function registerUnresolvedThread(
  state: ConversationState,
  threadId: string,
): ConversationState {
  return {
    ...state,
    activeThreads: Array.from(new Set([...state.activeThreads, threadId])),
  };
}

export function trackUnresolvedThreads(
  state: ConversationState,
  activeThreads: string[],
): ConversationState {
  return {
    ...state,
    activeThreads,
  };
}

export function getEligibleFollowUpOpportunities(
  handoff: DossierLiveHandoff,
  state: ConversationState,
): FollowUpOpportunity[] {
  return handoff.followUpOpportunities.filter((opportunity) => {
    if (!opportunity.relatedVeinId) {
      return true;
    }

    const relatedThread = state.threads.find(
      (thread) =>
        thread.relatedVeinId === opportunity.relatedVeinId ||
        thread.id === opportunity.relatedVeinId,
    );

    if (!relatedThread) {
      return false;
    }

    return relatedThread.status !== "resolved" && relatedThread.saturation >= 0.2;
  });
}

export function buildCandidateNextMoves(
  state: ConversationState,
  handoff: DossierLiveHandoff,
): CandidateNextMove[] {
  const contradictionMoves = state.threads
    .filter(
      (thread) =>
        thread.source === "contradiction" && thread.status !== "resolved",
    )
    .sort((left, right) => right.saturation - left.saturation)
    .map((thread) =>
      buildMove(
        `press:${thread.id}`,
        "press_contradiction",
        thread.id,
        `Press contradiction: ${thread.label}`,
        "Open contradiction remains unresolved and now has enough signal to justify pressure.",
        0.92 - thread.touchCount * 0.03 + thread.saturation * 0.05,
        buildPromptFragment("press_contradiction", handoff, thread.id),
      ),
    );

  const liveWireMoves = state.threads
    .filter(
      (thread) => thread.source === "live_wire" && thread.status !== "resolved",
    )
    .sort((left, right) => right.saturation - left.saturation)
    .map((thread) =>
      buildMove(
        `wire:${thread.id}`,
        "probe_live_wire",
        thread.id,
        `Probe live wire: ${thread.label}`,
        "Emotionally or reputationally charged material is active and worth careful probing.",
        0.78 - thread.touchCount * 0.02 + thread.saturation * 0.08,
        buildPromptFragment("probe_live_wire", handoff, thread.id),
      ),
    );

  const storyVeinMoves = state.threads
    .filter(
      (thread) =>
        thread.source === "story_vein" &&
        thread.status !== "resolved" &&
        thread.relatedVeinId !== null &&
        !state.coveredVeins.includes(thread.relatedVeinId),
    )
    .sort((left, right) => right.saturation - left.saturation)
    .map((thread) =>
      buildMove(
        `vein:${thread.id}`,
        "open_vein",
        thread.id,
        `Open vein: ${thread.label}`,
        "This core narrative lane is still undercovered and should be reopened or deepened.",
        0.64 - thread.touchCount * 0.02 + (1 - thread.saturation) * 0.08,
        buildPromptFragment("open_vein", handoff, thread.id),
      ),
    );

  const followUpMoves = getEligibleFollowUpOpportunities(handoff, state).map(
    (opportunity) =>
      buildMove(
        `followup:${opportunity.id}`,
        "deploy_follow_up",
        opportunity.relatedVeinId,
        `Deploy follow-up: ${opportunity.momentType.replaceAll("_", " ")}`,
        opportunity.whyNow,
        0.58,
        opportunity.promptFragments[0] ?? null,
      ),
  );

  const fallbackMoves = [
    buildMove(
      "let-breathe",
      "let_breathe",
      null,
      "Let the guest breathe",
      "No high-confidence pressure move is materially better than giving the conversation room.",
      0.25,
      null,
    ),
    buildMove(
      "wrap",
      "wrap",
      null,
      "Begin wrap path",
      "Coverage is sufficiently mature to start closing the interview without adding noise.",
      state.closureConfidence >= 0.7 ? 0.5 : 0.1,
      null,
    ),
  ];

  return [
    ...contradictionMoves,
    ...liveWireMoves,
    ...storyVeinMoves,
    ...followUpMoves,
    ...fallbackMoves,
  ]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6);
}

export function filterRepeatedNextMoves(
  state: ConversationState,
): ConversationState {
  const topCandidate = state.candidateNextMoves[0] ?? null;
  const topKey = topCandidate ? buildStableMoveKey(topCandidate) : null;
  const hadMeaningfulShift = state.lastMeaningfulShiftAt === state.updatedAt;
  const filteredMoves = state.candidateNextMoves.filter(
    (move) => !state.recentNudgeKeys.includes(buildStableMoveKey(move)),
  );
  const nextMoves =
    filteredMoves.length > 0 ? filteredMoves : state.candidateNextMoves.slice(0, 1);
  const nextKey = nextMoves[0] ? buildStableMoveKey(nextMoves[0]) : null;

  return {
    ...state,
    candidateNextMoves: nextMoves,
    recentNudgeKeys: nextKey
      ? [nextKey, ...state.recentNudgeKeys.filter((key) => key !== nextKey)].slice(
          0,
          RECENT_NUDGE_WINDOW,
        )
      : state.recentNudgeKeys,
    staleNudgeGuard:
      topKey !== null &&
      state.recentNudgeKeys.includes(topKey) &&
      !hadMeaningfulShift,
  };
}

export function processTranscriptTurn(
  state: ConversationState,
  turn: TranscriptTurn,
  handoff: DossierLiveHandoff,
): ConversationState {
  if (turn.id === state.lastProcessedTurnId || turn.timestamp < state.updatedAt) {
    return state;
  }

  const matchedThreads = matchTurnToThreads(turn, state);
  const matchedIds = new Set(matchedThreads.map((thread) => thread.id));
  let meaningfulShift = false;

  const threads = state.threads.map((thread) => {
    if (matchedIds.has(thread.id)) {
      const delta = computeSaturationDelta(turn, thread);
      const saturation = clamp(thread.saturation + delta);
      const status = deriveThreadStatus(thread, true, turn, saturation);

      if (thread.touchCount === 0 || status !== thread.status || delta >= 0.18) {
        meaningfulShift = true;
      }

      return {
        ...thread,
        saturation,
        status,
        touchCount: thread.touchCount + 1,
        lastTouchedAt: turn.timestamp,
        lastSpeaker: turn.speaker,
      };
    }

    return {
      ...thread,
      status: deriveThreadStatus(thread, false, turn, thread.saturation),
    };
  });

  const coveredVeins = Array.from(
    new Set(
      threads
        .filter(
          (thread) =>
            thread.source === "story_vein" &&
            thread.relatedVeinId !== null &&
            thread.saturation >= COVERED_VEIN_THRESHOLD,
        )
        .map((thread) => thread.relatedVeinId as string),
    ),
  );

  const unresolvedThreads = getThreadIdsByStatus(threads);
  const unresolvedRiskThreads = threads.filter(
    (thread) =>
      thread.status !== "resolved" &&
      (thread.source === "live_wire" || thread.source === "contradiction"),
  );
  const maxRiskSaturation = unresolvedRiskThreads.reduce(
    (max, thread) => Math.max(max, thread.saturation),
    0,
  );
  const emotionalHeat = clamp(maxRiskSaturation * 0.7 + turn.energyScore * 0.3);
  const storyVeinCount = Math.max(
    threads.filter((thread) => thread.source === "story_vein").length,
    1,
  );
  const resolvedThreadCount = threads.filter((thread) => thread.status === "resolved").length;
  const closureConfidence = clamp(
    coveredVeins.length / storyVeinCount * 0.65 +
      resolvedThreadCount / Math.max(threads.length, 1) * 0.35 -
      unresolvedRiskThreads.length * 0.03,
  );

  const intermediateState: ConversationState = {
    ...state,
    threads,
    coveredVeins,
    activeThreads: unresolvedThreads,
    emotionalHeat,
    closureConfidence,
    currentMode: state.currentMode,
    lastProcessedTurnId: turn.id,
    turnCount: state.turnCount + 1,
    lastMeaningfulShiftAt: meaningfulShift ? turn.timestamp : state.lastMeaningfulShiftAt,
    staleNudgeGuard: false,
    updatedAt: turn.timestamp,
    candidateNextMoves: [],
  };

  const stateWithMoves: ConversationState = {
    ...intermediateState,
    currentMode: deriveConversationMode(intermediateState, handoff),
    candidateNextMoves: buildCandidateNextMoves(intermediateState, handoff),
  };

  return filterRepeatedNextMoves(stateWithMoves);
}

export function planNextMove(
  state: ConversationState,
  handoff: DossierLiveHandoff,
) {
  const nextState = filterRepeatedNextMoves({
    ...state,
    candidateNextMoves: buildCandidateNextMoves(state, handoff),
  });

  return {
    mode: nextState.currentMode,
    shouldGenerateNudge:
      !nextState.staleNudgeGuard && nextState.candidateNextMoves.length > 0,
    candidateNextMoves: nextState.candidateNextMoves,
    staleNudgeGuard: nextState.staleNudgeGuard,
    unresolvedThreads: nextState.threads.filter(
      (thread) => thread.status !== "resolved",
    ),
  };
}
