import type { TranscriptTurn } from "@/types";
import { buildWholeTurnSpanRef } from "@/lib/transcript/organization/span-ref";
import type {
  TranscriptDerivedAnnotation,
  TranscriptRetrievalRecord,
} from "@/lib/transcript/organization/types";

function buildTurnRetrievalRecord(
  turn: TranscriptTurn,
): TranscriptRetrievalRecord {
  return {
    id: `retrieval:turn:${turn.id}`,
    sessionId: turn.sessionId,
    itemKind: "turn",
    turnId: turn.id,
    annotationId: null,
    annotationKind: null,
    lookupText: turn.text,
    spanRefs: [buildWholeTurnSpanRef(turn)],
  };
}

function buildAnnotationRetrievalRecord(
  annotation: TranscriptDerivedAnnotation,
): TranscriptRetrievalRecord {
  return {
    id: `retrieval:annotation:${annotation.id}`,
    sessionId: annotation.sessionId,
    itemKind: "annotation",
    turnId: annotation.turnId,
    annotationId: annotation.id,
    annotationKind: annotation.kind,
    lookupText: annotation.label,
    spanRefs: annotation.spanRefs,
  };
}

export function buildTranscriptRetrievalRecords(
  turns: TranscriptTurn[],
  annotations: TranscriptDerivedAnnotation[],
): TranscriptRetrievalRecord[] {
  return [
    ...turns.map(buildTurnRetrievalRecord),
    ...annotations.map(buildAnnotationRetrievalRecord),
  ];
}
