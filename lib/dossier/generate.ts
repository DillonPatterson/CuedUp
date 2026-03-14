import { buildDossierPrompt, buildDossierInputSummary } from "@/lib/prompts/dossier";
import {
  dossierGenerationInputSchema,
  type DossierGenerationInput,
} from "@/lib/dossier/contracts";
import { buildMockDossier } from "@/lib/dossier/mock";
import { validateDossierPayload } from "@/lib/dossier/parse";
import {
  createDossierLiveHandoff,
  type DossierLiveHandoff,
} from "@/lib/state/dossier-handoff";
import type { Dossier } from "@/types";

export type DossierPersistenceShape = {
  dossierRow: {
    guest_id: string;
    story_veins: Dossier["storyVeins"];
    live_wires: Dossier["liveWires"];
    forbidden_topics: string[];
    contradiction_map: Dossier["contradictions"];
    source_count: number;
  };
  deferredFields: {
    title: string;
    guestSummary: string;
    unaskedTopics: Dossier["unaskedTopics"];
    overusedTopics: Dossier["overusedTopics"];
    audienceHooks: Dossier["audienceHooks"];
    openingPaths: Dossier["openingPaths"];
    followUpOpportunities: Dossier["followUpOpportunities"];
    sourceReferences: Dossier["sourceReferences"];
    confidence: Dossier["confidence"];
  };
};

export type GeneratedDossierBundle = {
  input: DossierGenerationInput;
  inputSummary: string;
  prompt: string;
  dossier: Dossier;
  persistenceShape: DossierPersistenceShape;
  liveHandoff: DossierLiveHandoff;
};

export function toDossierPersistenceShape(
  dossier: Dossier,
): DossierPersistenceShape {
  return {
    dossierRow: {
      guest_id: dossier.guestId,
      story_veins: dossier.storyVeins,
      live_wires: dossier.liveWires,
      forbidden_topics: dossier.overusedTopics,
      contradiction_map: dossier.contradictions,
      source_count: dossier.sourceReferences.length,
    },
    deferredFields: {
      title: dossier.title,
      guestSummary: dossier.guestSummary,
      unaskedTopics: dossier.unaskedTopics,
      overusedTopics: dossier.overusedTopics,
      audienceHooks: dossier.audienceHooks,
      openingPaths: dossier.openingPaths,
      followUpOpportunities: dossier.followUpOpportunities,
      sourceReferences: dossier.sourceReferences,
      confidence: dossier.confidence,
    },
  };
}

export function generateMockDossierBundle(
  rawInput: DossierGenerationInput,
): GeneratedDossierBundle {
  const input = dossierGenerationInputSchema.parse(rawInput);
  const inputSummary = buildDossierInputSummary(input);
  const prompt = buildDossierPrompt(input);
  const rawDossier = buildMockDossier(input);
  const validation = validateDossierPayload(rawDossier);

  if (!validation.success) {
    throw new Error(
      `Mock dossier generation produced invalid output: ${validation.issues
        .map((issue) => `${issue.path || "<root>"} ${issue.message}`)
        .join("; ")}`,
    );
  }

  return {
    input,
    inputSummary,
    prompt,
    dossier: validation.data,
    persistenceShape: toDossierPersistenceShape(validation.data),
    liveHandoff: createDossierLiveHandoff(validation.data),
  };
}
