import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
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

export type InterviewReplayViewModel = {
  state: ReturnType<typeof seedConversationStateFromDossier>;
  currentTurn: TranscriptTurn | null;
  recentTurns: TranscriptTurn[];
  processedTurns: TranscriptTurn[];
  unresolvedThreads: ReturnType<typeof seedConversationStateFromDossier>["threads"];
  topMoves: ReturnType<typeof seedConversationStateFromDossier>["candidateNextMoves"];
  storyVeinProgress: StoryVeinProgress[];
};

const RECENT_TURN_WINDOW = 5;

export function buildInterviewReplayViewModel(
  sessionId: string,
  handoff: DossierLiveHandoff,
  turns: TranscriptTurn[],
  currentTurnIndex: number,
): InterviewReplayViewModel {
  let state = seedConversationStateFromDossier(sessionId, handoff);
  const processedTurns =
    currentTurnIndex >= 0 ? turns.slice(0, currentTurnIndex + 1) : [];

  for (const turn of processedTurns) {
    state = processTranscriptTurn(state, turn, handoff);
  }

  const recentTurns = processedTurns.slice(-RECENT_TURN_WINDOW);
  const currentTurn = processedTurns.at(-1) ?? null;
  const unresolvedThreads = state.threads
    .filter((thread) => thread.status !== "resolved")
    .sort((left, right) => right.saturation - left.saturation);
  const storyVeinProgress = handoff.activeStoryVeins.map((vein) => {
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

  return {
    state,
    currentTurn,
    recentTurns,
    processedTurns,
    unresolvedThreads,
    topMoves: state.candidateNextMoves.slice(0, 3),
    storyVeinProgress,
  };
}
