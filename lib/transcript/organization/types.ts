import type {
  ReplayAffectiveIntensity,
  ReplayCompletionStatus,
  ReplayTurnAnalysis,
} from "@/lib/transcript/turn-analysis";
import type { ReplayTurnMemory } from "@/lib/transcript/turn-memory";

export type TranscriptDerivedAnnotationKind =
  | "entity"
  | "theme"
  | "claim"
  | "thread_cue"
  | "tension";

export type TranscriptOrganizationSalience = "low" | "medium" | "high";

export interface TranscriptDerivedAnnotation {
  id: string;
  sessionId: string;
  turnId: string;
  kind: TranscriptDerivedAnnotationKind;
  label: string;
  salience: TranscriptOrganizationSalience;
  provenance: "replay_metadata";
}

export interface TranscriptOrganizationSourceMetadata {
  analysis: ReplayTurnAnalysis;
  memory: ReplayTurnMemory;
}

export type TranscriptDebtReason =
  | "opened_unresolved"
  | "incomplete_turn"
  | "truncated_turn"
  | "interruption"
  | "affective_weight"
  | "deflection"
  | "stale_unresolved"
  | "revisited"
  | "resolution_language";

export interface TranscriptCompletionDebtEntry {
  id: string;
  label: string;
  sourceKind: Exclude<TranscriptDerivedAnnotationKind, "entity">;
  openedAtTurnId: string;
  lastSeenTurnId: string;
  lastSeenAt: string | null;
  turnIds: string[];
  debtScore: number;
  debtReasons: TranscriptDebtReason[];
  interrupted: boolean;
  affectiveWeight: ReplayAffectiveIntensity;
  completionStatus: ReplayCompletionStatus;
  currentTurnLinked: boolean;
  bringBackPriority: TranscriptRecallReadinessBand;
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
  completionDebtScore?: number;
  completionDebtReasons?: TranscriptDebtReason[];
  interrupted?: boolean;
  affectiveWeight?: ReplayAffectiveIntensity;
  completionStatus?: ReplayCompletionStatus;
  bringBackPriority?: TranscriptRecallReadinessBand;
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
  lastSeenAt: string | null;
  relevanceToCurrentTurn: TranscriptRecallRelevance;
  readiness: TranscriptRecallReadinessBand;
  completionDebtScore: number;
  completionDebtReasons: TranscriptDebtReason[];
  interrupted: boolean;
  affectiveWeight: ReplayAffectiveIntensity;
  reason: string;
}

export type TranscriptNextNudgeSourceKind =
  | "directive"
  | "thread"
  | "claim"
  | "tension"
  | "interruption"
  | "theme";

export type TranscriptNextNudgePromptAngle =
  | "circle_back"
  | "press_gently"
  | "clarify"
  | "let_it_breathe"
  | "return_to_interruption"
  | "test_contradiction";

export interface TranscriptNextNudgeCandidate {
  id: string;
  label: string;
  sourceKind: TranscriptNextNudgeSourceKind;
  promptAngle: TranscriptNextNudgePromptAngle;
  readiness: TranscriptRecallReadinessBand;
  reason: string;
  supportingTurnIds: string[];
  debtScore: number;
  affectiveWeight: ReplayAffectiveIntensity;
  interrupted: boolean;
}

export interface TranscriptNextNudgeSelection {
  bestCandidate: TranscriptNextNudgeCandidate | null;
  // Backup candidates are replay/debug only and intentionally stay out of the
  // sparse live surface and any later audio-delivery path.
  backupCandidates: TranscriptNextNudgeCandidate[];
}

export interface TranscriptOrganizationSnapshot {
  sessionId: string | null;
  sourceMetadataByTurnId: Record<string, TranscriptOrganizationSourceMetadata>;
  annotations: TranscriptDerivedAnnotation[];
  annotationsByTurnId: Record<string, TranscriptDerivedAnnotation[]>;
  emergingThemes: TranscriptOrganizationBucketItem[];
  openThreads: TranscriptOrganizationBucketItem[];
  notableClaims: TranscriptOrganizationBucketItem[];
  tensionWatch: TranscriptOrganizationBucketItem[];
  completionDebt: TranscriptCompletionDebtEntry[];
  recallCandidates: TranscriptRecallCandidate[];
  nextNudge: TranscriptNextNudgeSelection;
  summary: {
    entities: string[];
    themes: string[];
    claims: string[];
    unresolvedThreadCues: string[];
    tensions: string[];
  };
}
