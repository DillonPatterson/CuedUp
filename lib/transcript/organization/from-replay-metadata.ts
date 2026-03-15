import type { TranscriptTurn } from "@/types";
import type {
  TranscriptDerivedAnnotation,
  TranscriptDerivedAnnotationKind,
  TranscriptOrganizationSourceMetadata,
} from "@/lib/transcript/organization/types";

type ReplayMemoryField =
  | "entities"
  | "themes"
  | "claims"
  | "unresolvedThreadCues"
  | "contradictionSignals";

const annotationMappings: Array<{
  field: ReplayMemoryField;
  kind: TranscriptDerivedAnnotationKind;
}> = [
  { field: "entities", kind: "entity" },
  { field: "themes", kind: "theme" },
  { field: "claims", kind: "claim" },
  { field: "unresolvedThreadCues", kind: "thread_cue" },
  { field: "contradictionSignals", kind: "tension" },
];

function buildAnnotationKey(value: string) {
  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return key || "item";
}

function buildAnnotationId(
  turnId: string,
  kind: TranscriptDerivedAnnotationKind,
  label: string,
) {
  return `annotation:${turnId}:${kind}:${buildAnnotationKey(label)}`;
}

export function buildAnnotationsFromReplayMetadata(
  turn: TranscriptTurn,
  metadata: TranscriptOrganizationSourceMetadata | undefined,
): TranscriptDerivedAnnotation[] {
  if (!metadata) {
    return [];
  }

  return annotationMappings.flatMap(({ field, kind }) =>
    metadata.memory[field].map((label) => ({
      id: buildAnnotationId(turn.id, kind, label),
      sessionId: turn.sessionId,
      turnId: turn.id,
      kind,
      label,
      salience: metadata.memory.salience,
      provenance: "replay_metadata" as const,
    })),
  );
}
