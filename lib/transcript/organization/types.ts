export type TranscriptDerivedAnnotationKind =
  | "entity"
  | "theme"
  | "claim"
  | "thread_cue"
  | "tension";

export type TranscriptOrganizationSalience = "low" | "medium" | "high";

export interface TranscriptSpanRef {
  sessionId: string;
  turnId: string;
  scope: "turn";
}

export interface TranscriptDerivedAnnotation {
  id: string;
  sessionId: string;
  turnId: string;
  kind: TranscriptDerivedAnnotationKind;
  label: string;
  salience: TranscriptOrganizationSalience;
  provenance: "replay_metadata";
  spanRefs: TranscriptSpanRef[];
}

export interface TranscriptRetrievalRecord {
  id: string;
  sessionId: string;
  itemKind: "turn" | "annotation";
  turnId: string;
  annotationId: string | null;
  annotationKind: TranscriptDerivedAnnotationKind | null;
  lookupText: string;
  spanRefs: TranscriptSpanRef[];
}

export interface TranscriptOrganizationSnapshot {
  sessionId: string | null;
  annotations: TranscriptDerivedAnnotation[];
  annotationsByTurnId: Record<string, TranscriptDerivedAnnotation[]>;
  retrievalRecords: TranscriptRetrievalRecord[];
  summary: {
    entities: string[];
    themes: string[];
    claims: string[];
    unresolvedThreadCues: string[];
    tensions: string[];
  };
}
