import {
  transcriptTurnInputSchema,
  transcriptTurnSchema,
} from "@/lib/schemas/transcript";
import type { TranscriptTurn, TranscriptTurnInput } from "@/types";

export type ManualTranscriptTurnDraft = Omit<
  TranscriptTurnInput,
  "sessionId" | "timestamp" | "threadIdLink"
> & {
  threadIdLink?: string | null;
};

const MANUAL_TURN_STEP_MS = 15_000;
const FALLBACK_TIMESTAMP = "2026-03-14T10:00:00.000Z";

function buildManualTurnId(turnCount: number) {
  return `00000000-0000-4000-8000-${(turnCount + 1).toString().padStart(12, "0")}`;
}

function buildNextTimestamp(turns: TranscriptTurn[]) {
  const lastTurn = turns.at(-1);

  if (!lastTurn) {
    return FALLBACK_TIMESTAMP;
  }

  return new Date(
    new Date(lastTurn.timestamp).getTime() + MANUAL_TURN_STEP_MS,
  ).toISOString();
}

export function appendManualTranscriptTurn(
  turns: TranscriptTurn[],
  sessionId: string,
  draft: ManualTranscriptTurnDraft,
) {
  const input = transcriptTurnInputSchema.parse({
    sessionId,
    timestamp: buildNextTimestamp(turns),
    speaker: draft.speaker,
    text: draft.text,
    energyScore: draft.energyScore,
    specificityScore: draft.specificityScore,
    evasionScore: draft.evasionScore,
    noveltyScore: draft.noveltyScore,
    threadIdLink: draft.threadIdLink ?? null,
  });

  const nextTurn = transcriptTurnSchema.parse({
    ...input,
    id: buildManualTurnId(turns.length),
  });

  return [...turns, nextTurn];
}
