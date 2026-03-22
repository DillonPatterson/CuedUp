import type { TranscriptTurn } from "@/lib/schemas/transcript";
import type { CanonicalTurn } from "@/lib/session-memory/contracts";

const DEBUG_SESSION_MEMORY_SCORES = {
  energyScore: 0.5,
  specificityScore: 0.5,
  evasionScore: 0.15,
  noveltyScore: 0.5,
} as const;

// Session-memory proof reuses the existing deterministic transcript analyzer.
// This adapter is the only place where an assembled debug turn is projected
// into that analyzer boundary. Keeping it here makes the overlap explicit
// instead of fabricating transcript turns ad hoc inside the ledger logic.
export function buildDebugTranscriptTurn(
  canonicalTurn: CanonicalTurn,
): TranscriptTurn {
  return {
    id: canonicalTurn.id,
    sessionId: canonicalTurn.sessionId,
    timestamp: canonicalTurn.finalizedAt,
    speaker: canonicalTurn.speaker ?? "guest",
    text: canonicalTurn.text,
    energyScore: DEBUG_SESSION_MEMORY_SCORES.energyScore,
    specificityScore: DEBUG_SESSION_MEMORY_SCORES.specificityScore,
    evasionScore: DEBUG_SESSION_MEMORY_SCORES.evasionScore,
    noveltyScore: DEBUG_SESSION_MEMORY_SCORES.noveltyScore,
    threadIdLink: null,
  };
}
