import type { DossierLiveHandoff } from "@/types";

const EMPTY_REPLAY_GUEST_ID = "00000000-0000-4000-8000-000000000001";

export function buildFreshReplayHandoff(): DossierLiveHandoff {
  return {
    guestId: EMPTY_REPLAY_GUEST_ID,
    title: "Fresh interview workspace",
    activeStoryVeins: [],
    liveWires: [],
    contradictionCandidates: [],
    followUpOpportunities: [],
    openingPaths: [],
    audienceHooks: [],
  };
}
