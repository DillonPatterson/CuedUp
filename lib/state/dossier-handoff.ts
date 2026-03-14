import type { Dossier } from "@/lib/schemas/dossier";

export function getActiveStoryVeins(dossier: Dossier) {
  return dossier.storyVeins
    .filter((vein) => vein.status !== "avoid" && vein.status !== "exhausted")
    .sort((left, right) => right.title.localeCompare(left.title))
    .sort((left, right) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      return rank[right.importance] - rank[left.importance];
    });
}

export function getLiveWireCandidates(dossier: Dossier) {
  return dossier.liveWires.filter((wire) => wire.confidence !== "speculative");
}

export function getContradictionCandidates(dossier: Dossier) {
  return dossier.contradictions.filter(
    (item) => item.severity === "major" || item.severity === "critical",
  );
}

export function getEligibleFollowUpOpportunities(dossier: Dossier) {
  return dossier.followUpOpportunities.filter(
    (item) => item.promptFragments.length > 0,
  );
}

export function createDossierLiveHandoff(dossier: Dossier) {
  return {
    guestId: dossier.guestId,
    title: dossier.title,
    activeStoryVeins: getActiveStoryVeins(dossier),
    liveWires: getLiveWireCandidates(dossier),
    contradictionCandidates: getContradictionCandidates(dossier),
    followUpOpportunities: getEligibleFollowUpOpportunities(dossier),
    openingPaths: dossier.openingPaths,
    audienceHooks: dossier.audienceHooks,
  };
}

export type DossierLiveHandoff = ReturnType<typeof createDossierLiveHandoff>;
