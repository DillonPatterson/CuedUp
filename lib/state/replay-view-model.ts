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

type LiveThreadPreview = {
  id: string;
  label: string;
  urgency: "active" | "cooling";
};

export type InterviewReplayViewModel = {
  state: ReturnType<typeof seedConversationStateFromDossier>;
  currentTurn: TranscriptTurn | null;
  previousTurn: TranscriptTurn | null;
  recentTurns: TranscriptTurn[];
  processedTurns: TranscriptTurn[];
  unresolvedThreads: ReturnType<typeof seedConversationStateFromDossier>["threads"];
  primaryMove: ReturnType<typeof seedConversationStateFromDossier>["candidateNextMoves"][number] | null;
  liveCue: string | null;
  liveThreads: LiveThreadPreview[];
  topMoves: ReturnType<typeof seedConversationStateFromDossier>["candidateNextMoves"];
  storyVeinProgress: StoryVeinProgress[];
};

const RECENT_TURN_WINDOW = 5;
const LIVE_THREAD_LIMIT = 2;

function clipWords(value: string, maxWords: number) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, maxWords).join(" ");
}

function stripMovePrefix(value: string) {
  return value
    .replace(/^Press contradiction:\s*/i, "")
    .replace(/^Probe live wire:\s*/i, "")
    .replace(/^Open vein:\s*/i, "")
    .replace(/^Deploy follow-up:\s*/i, "");
}

function buildLiveCue(
  primaryMove: InterviewReplayViewModel["primaryMove"],
  currentTurn: TranscriptTurn | null,
) {
  if (!currentTurn) {
    return "Listen first";
  }

  if (!primaryMove) {
    return null;
  }

  const baseLabel = stripMovePrefix(primaryMove.label);

  switch (primaryMove.type) {
    case "press_contradiction":
      return clipWords(`Press ${baseLabel}`, 8);
    case "probe_live_wire":
      return clipWords(`Stay with ${baseLabel}`, 8);
    case "open_vein":
      return clipWords(`Open ${baseLabel}`, 8);
    case "deploy_follow_up":
      return clipWords(primaryMove.promptFragment ?? "Follow up now", 8);
    case "let_breathe":
      return "Let it breathe";
    case "wrap":
      return "Start wrapping";
    default:
      return clipWords(baseLabel, 8);
  }
}

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
  const previousTurn =
    processedTurns.length > 1 ? processedTurns[processedTurns.length - 2] : null;
  const unresolvedThreads = state.threads
    .filter((thread) => thread.status !== "resolved")
    .sort((left, right) => right.saturation - left.saturation);
  const primaryMove = state.candidateNextMoves[0] ?? null;
  const liveThreads = unresolvedThreads
    .slice()
    .sort((left, right) => {
      if (left.status === "active" && right.status !== "active") {
        return -1;
      }

      if (left.status !== "active" && right.status === "active") {
        return 1;
      }

      return right.saturation - left.saturation;
    })
    .slice(0, LIVE_THREAD_LIMIT)
    .map((thread) => ({
      id: thread.id,
      label: thread.label,
      urgency: thread.status === "active" ? ("active" as const) : ("cooling" as const),
    }));
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
    previousTurn,
    recentTurns,
    processedTurns,
    unresolvedThreads,
    primaryMove,
    liveCue: buildLiveCue(primaryMove, currentTurn),
    liveThreads,
    topMoves: state.candidateNextMoves.slice(0, 3),
    storyVeinProgress,
  };
}
