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

export interface TranscriptOrganizationBucketItem {
  id: string;
  label: string;
  sourceKind: TranscriptDerivedAnnotationKind;
  turnIds: string[];
  occurrenceCount: number;
  salience: TranscriptOrganizationSalience;
  currentTurnLinked: boolean;
  lastSeenTurnId: string | null;
  lastSeenAt: string | null;
}

export type TranscriptRecallRecency = "fresh" | "recent" | "stale";
export type TranscriptRecallRelevance = "low" | "medium" | "high";
export type TranscriptRecallReadinessBand =
  | "not_ready"
  | "warming"
  | "ready"
  | "urgent";

export interface TranscriptRecallCandidate {
  id: string;
  label: string;
  sourceKind: Exclude<TranscriptDerivedAnnotationKind, "entity">;
  turnIds: string[];
  salience: TranscriptOrganizationSalience;
  recency: TranscriptRecallRecency;
  relevanceToCurrentTurn: TranscriptRecallRelevance;
  readiness: TranscriptRecallReadinessBand;
  reason: string;
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
  emergingThemes: TranscriptOrganizationBucketItem[];
  openThreads: TranscriptOrganizationBucketItem[];
  notableClaims: TranscriptOrganizationBucketItem[];
  tensionWatch: TranscriptOrganizationBucketItem[];
  recallCandidates: TranscriptRecallCandidate[];
  summary: {
    entities: string[];
    themes: string[];
    claims: string[];
    unresolvedThreadCues: string[];
    tensions: string[];
  };
}
