import type { TranscriptTurn } from "@/types";
import type { ReplayCommittedTurnMetadata } from "@/lib/transcript/manual-turns";
import { buildTranscriptRetrievalRecords } from "@/lib/transcript/organization/build-retrieval-records";
import { buildAnnotationsFromReplayMetadata } from "@/lib/transcript/organization/from-replay-metadata";
import type {
  TranscriptDerivedAnnotation,
  TranscriptOrganizationSnapshot,
} from "@/lib/transcript/organization/types";

function collectUniqueLabels(
  annotations: TranscriptDerivedAnnotation[],
  kind: TranscriptDerivedAnnotation["kind"],
) {
  const seen = new Set<string>();

  return annotations.reduce<string[]>((labels, annotation) => {
    if (annotation.kind !== kind || seen.has(annotation.label)) {
      return labels;
    }

    seen.add(annotation.label);
    labels.push(annotation.label);
    return labels;
  }, []);
}

function buildAnnotationsByTurnId(
  turns: TranscriptTurn[],
  annotations: TranscriptDerivedAnnotation[],
) {
  const annotationsByTurnId = turns.reduce<
    Record<string, TranscriptDerivedAnnotation[]>
  >((result, turn) => {
    result[turn.id] = [];
    return result;
  }, {});

  annotations.forEach((annotation) => {
    if (!annotationsByTurnId[annotation.turnId]) {
      annotationsByTurnId[annotation.turnId] = [];
    }

    annotationsByTurnId[annotation.turnId].push(annotation);
  });

  return annotationsByTurnId;
}

export function buildReplayTranscriptOrganization(
  turns: TranscriptTurn[],
  replayMetadata: Record<string, ReplayCommittedTurnMetadata>,
): TranscriptOrganizationSnapshot {
  const annotations = turns.flatMap((turn) =>
    buildAnnotationsFromReplayMetadata(turn, replayMetadata[turn.id]),
  );
  const annotationsByTurnId = buildAnnotationsByTurnId(turns, annotations);

  return {
    sessionId: turns[0]?.sessionId ?? null,
    annotations,
    annotationsByTurnId,
    retrievalRecords: buildTranscriptRetrievalRecords(turns, annotations),
    summary: {
      entities: collectUniqueLabels(annotations, "entity"),
      themes: collectUniqueLabels(annotations, "theme"),
      claims: collectUniqueLabels(annotations, "claim"),
      unresolvedThreadCues: collectUniqueLabels(annotations, "thread_cue"),
      tensions: collectUniqueLabels(annotations, "tension"),
    },
  };
}
