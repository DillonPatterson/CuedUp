import type {
  CandidateNextMove,
  ConversationState,
  ConversationThread,
  DossierLiveHandoff,
  TranscriptTurn,
} from "@/types";
import {
  evaluatePresenceGuard,
  type PresenceGuardDecision,
  type SurfaceCue,
} from "@/lib/live/presence-guard";
import {
  processTranscriptTurn,
  seedConversationStateFromDossier,
} from "@/lib/state/conversation-engine";

type StoryVeinProgress = {
  id: string;
  title: string;
  saturation: number;
  status: "covered" | "in_progress" | "seeded";
};

export type LiveThreadIndicator = {
  id: string;
  urgency: "active" | "cooling";
};

export type InterviewSessionSnapshot = {
  index: number;
  conversationState: ConversationState;
  surfaceCue: SurfaceCue | null;
  threadIndicators: LiveThreadIndicator[];
  decisionLogEntry: PresenceGuardDecision;
  guardDecisions: PresenceGuardDecision[];
  currentTurn: TranscriptTurn | null;
  previousTurn: TranscriptTurn | null;
  recentTurns: TranscriptTurn[];
  unresolvedThreads: ConversationThread[];
  topMoves: CandidateNextMove[];
  storyVeinProgress: StoryVeinProgress[];
};

export type InterviewSessionTimeline = {
  snapshots: InterviewSessionSnapshot[];
  decisionLog: PresenceGuardDecision[];
};

const RECENT_TURN_WINDOW = 5;

function prioritizeThreads(threads: ConversationThread[]) {
  return threads
    .filter((thread) => thread.status !== "resolved")
    .sort((left, right) => {
      if (left.status === "active" && right.status !== "active") {
        return -1;
      }

      if (left.status !== "active" && right.status === "active") {
        return 1;
      }

      if (left.source !== right.source) {
        const sourceRank = {
          contradiction: 3,
          live_wire: 2,
          story_vein: 1,
        };

        return sourceRank[right.source] - sourceRank[left.source];
      }

      return right.saturation - left.saturation;
    });
}

function buildThreadIndicators(unresolvedThreads: ConversationThread[]) {
  const prioritizedThreads = prioritizeThreads(unresolvedThreads);
  const indicators: LiveThreadIndicator[] = [];

  if (prioritizedThreads[0]) {
    indicators.push({
      id: prioritizedThreads[0].id,
      urgency:
        prioritizedThreads[0].status === "active" ? "active" : "cooling",
    });
  }

  if (
    prioritizedThreads[1] &&
    prioritizedThreads[1].status === "active"
  ) {
    indicators.push({
      id: prioritizedThreads[1].id,
      urgency: "active",
    });
  }

  return indicators;
}

function buildStoryVeinProgress(
  handoff: DossierLiveHandoff,
  state: ConversationState,
) {
  return handoff.activeStoryVeins.map((vein) => {
    const thread = state.threads.find((item) => item.relatedVeinId === vein.id);
    const saturation = thread?.saturation ?? 0;

    return {
      id: vein.id,
      title: vein.title,
      saturation,
      status: state.coveredVeins.includes(vein.id)
        ? ("covered" as const)
        : saturation > 0
          ? ("in_progress" as const)
          : ("seeded" as const),
    };
  });
}

function buildSnapshot(
  index: number,
  state: ConversationState,
  handoff: DossierLiveHandoff,
  surfaceCue: SurfaceCue | null,
  decisionLogEntry: PresenceGuardDecision,
  guardDecisions: PresenceGuardDecision[],
  processedTurns: TranscriptTurn[],
) {
  const unresolvedThreads = prioritizeThreads(state.threads);
  const currentTurn = processedTurns.at(-1) ?? null;
  const previousTurn =
    processedTurns.length > 1 ? processedTurns[processedTurns.length - 2] : null;

  return {
    index,
    conversationState: state,
    surfaceCue,
    threadIndicators: buildThreadIndicators(unresolvedThreads),
    decisionLogEntry,
    guardDecisions,
    currentTurn,
    previousTurn,
    recentTurns: processedTurns.slice(-RECENT_TURN_WINDOW),
    unresolvedThreads,
    topMoves: state.candidateNextMoves.slice(0, 3),
    storyVeinProgress: buildStoryVeinProgress(handoff, state),
  };
}

export function buildInterviewSessionTimeline(
  sessionId: string,
  handoff: DossierLiveHandoff,
  turns: TranscriptTurn[],
): InterviewSessionTimeline {
  let state = seedConversationStateFromDossier(sessionId, handoff);
  const surfacedCueHistory: SurfaceCue[] = [];
  const decisionLog: PresenceGuardDecision[] = [];
  const snapshots: InterviewSessionSnapshot[] = [];
  const initialDecision: PresenceGuardDecision = {
    outcome: "none",
    reasons: ["no_candidate"],
    candidateId: null,
    candidateLabel: null,
    formattedCue: null,
    sourceTurnId: null,
    timestamp: state.updatedAt,
  };

  snapshots.push(
    buildSnapshot(
      0,
      state,
      handoff,
      null,
      initialDecision,
      [initialDecision],
      [],
    ),
  );
  decisionLog.push(initialDecision);

  const processedTurns: TranscriptTurn[] = [];

  turns.forEach((turn, index) => {
    processedTurns.push(turn);
    state = processTranscriptTurn(state, turn, handoff);

    const guardResult = evaluatePresenceGuard(state.candidateNextMoves, {
      state,
      currentTurn: turn,
      recentTurns: processedTurns,
      surfacedCueHistory,
    });

    if (guardResult.surfaceCue) {
      surfacedCueHistory.push(guardResult.surfaceCue);
    }

    snapshots.push(
      buildSnapshot(
        index + 1,
        state,
        handoff,
        guardResult.surfaceCue,
        guardResult.decisionLogEntry,
        guardResult.guardDecisions,
        processedTurns,
      ),
    );
    decisionLog.push(guardResult.decisionLogEntry);
  });

  return {
    snapshots,
    decisionLog,
  };
}
