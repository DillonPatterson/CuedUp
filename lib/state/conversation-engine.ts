import type { DossierLiveHandoff } from "@/lib/state/dossier-handoff";
import type { ConversationState, FollowUpOpportunity } from "@/types";

export function seedConversationStateFromDossier(
  sessionId: string,
  handoff: DossierLiveHandoff,
): ConversationState {
  return {
    id: crypto.randomUUID(),
    sessionId,
    coveredVeins: [],
    activeThreads: handoff.activeStoryVeins.map((vein) => vein.id),
    emotionalHeat: handoff.liveWires.length > 0 ? 0.3 : 0.1,
    closureConfidence: 0,
    currentMode: "explore",
    lastMeaningfulShiftAt: null,
    staleNudgeGuard: false,
    updatedAt: new Date().toISOString(),
  };
}

export function updateTopicCoverage(
  state: ConversationState,
  coveredVeins: string[],
): ConversationState {
  return {
    ...state,
    coveredVeins: Array.from(new Set([...state.coveredVeins, ...coveredVeins])),
    updatedAt: new Date().toISOString(),
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
    updatedAt: new Date().toISOString(),
  };
}

export function trackUnresolvedThreads(
  state: ConversationState,
  activeThreads: string[],
): ConversationState {
  return {
    ...state,
    activeThreads,
    updatedAt: new Date().toISOString(),
  };
}

export function applyStaleNudgeProtection(
  state: ConversationState,
  lastNudgeAt: string | null,
): ConversationState {
  const staleNudgeGuard = Boolean(lastNudgeAt) && state.closureConfidence > 0.8;

  return {
    ...state,
    staleNudgeGuard,
    updatedAt: new Date().toISOString(),
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

    return !state.coveredVeins.includes(opportunity.relatedVeinId);
  });
}

export function planNextMove(
  state: ConversationState,
  handoff: DossierLiveHandoff,
) {
  return {
    mode: state.currentMode,
    shouldGenerateNudge: !state.staleNudgeGuard,
    eligibleFollowUps: getEligibleFollowUpOpportunities(handoff, state),
    notes:
      "Placeholder pipeline: future work will combine transcript turns, dossier handoff signals, and unresolved-thread pressure to choose the next move.",
  };
}
