import type { TranscriptTurn } from "@/types";
import type { TranscriptSpanRef } from "@/lib/transcript/organization/types";

export function buildWholeTurnSpanRef(
  turn: TranscriptTurn,
): TranscriptSpanRef {
  return {
    sessionId: turn.sessionId,
    turnId: turn.id,
    scope: "turn",
  };
}
