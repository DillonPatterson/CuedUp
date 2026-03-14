import { z } from "zod";
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
const MANUAL_TURN_ID_PREFIX = "00000000-0000-4000-8000-";
const REPLAY_IMPORT_DEFAULTS = {
  speaker: "guest" as const,
  energyScore: 0.5,
  specificityScore: 0.6,
  evasionScore: 0.1,
  noveltyScore: 0.5,
  threadIdLink: null,
};

const replayImportedTurnSchema = z.object({
  speaker: transcriptTurnInputSchema.shape.speaker.default(
    REPLAY_IMPORT_DEFAULTS.speaker,
  ),
  text: transcriptTurnInputSchema.shape.text,
  energyScore: transcriptTurnInputSchema.shape.energyScore.default(
    REPLAY_IMPORT_DEFAULTS.energyScore,
  ),
  specificityScore: transcriptTurnInputSchema.shape.specificityScore.default(
    REPLAY_IMPORT_DEFAULTS.specificityScore,
  ),
  evasionScore: transcriptTurnInputSchema.shape.evasionScore.default(
    REPLAY_IMPORT_DEFAULTS.evasionScore,
  ),
  noveltyScore: transcriptTurnInputSchema.shape.noveltyScore.default(
    REPLAY_IMPORT_DEFAULTS.noveltyScore,
  ),
  threadIdLink: z.string().uuid().nullable().optional().default(null),
});

const replayImportedTranscriptSchema = z.array(replayImportedTurnSchema);

function countManualTurns(turns: TranscriptTurn[]) {
  return turns.filter((turn) => turn.id.startsWith(MANUAL_TURN_ID_PREFIX)).length;
}

function buildManualTurnId(manualTurnCount: number) {
  return `${MANUAL_TURN_ID_PREFIX}${(manualTurnCount + 1).toString().padStart(12, "0")}`;
}

function buildNextTimestamp(turns: TranscriptTurn[]) {
  const lastTurn = turns.at(-1);

  if (!lastTurn) {
    return FALLBACK_TIMESTAMP;
  }

  // Fixed 15-second stepping is only a replay/manual convenience for deterministic
  // ordering. It intentionally distorts real conversational timing, so cooldown
  // behavior here is useful for logic checks but not a faithful timing simulation.
  return new Date(
    new Date(lastTurn.timestamp).getTime() + MANUAL_TURN_STEP_MS,
  ).toISOString();
}

export function appendManualTranscriptTurn(
  turns: TranscriptTurn[],
  sessionId: string,
  draft: ManualTranscriptTurnDraft,
) {
  const nextManualTurnCount = countManualTurns(turns);
  const input = transcriptTurnInputSchema.parse({
    sessionId,
    timestamp: buildNextTimestamp(turns),
    speaker: draft.speaker,
    text: draft.text,
    energyScore: draft.energyScore,
    specificityScore: draft.specificityScore,
    evasionScore: draft.evasionScore,
    noveltyScore: draft.noveltyScore,
    // Replay-only manual input currently exercises keyword/text matching more than
    // direct thread-linking. `threadIdLink` stays null unless a caller provides it.
    threadIdLink: draft.threadIdLink ?? null,
  });

  const nextTurn = transcriptTurnSchema.parse({
    ...input,
    id: buildManualTurnId(nextManualTurnCount),
  });

  return [...turns, nextTurn];
}

export function importReplayTranscriptTurns(
  turns: TranscriptTurn[],
  sessionId: string,
  rawTranscript: string,
) {
  return importReplayTranscriptTurnDrafts(
    turns,
    sessionId,
    JSON.parse(rawTranscript),
  );
}

export function importReplayTranscriptTurnDrafts(
  turns: TranscriptTurn[],
  sessionId: string,
  transcriptDrafts: unknown,
) {
  const parsedTranscript = replayImportedTranscriptSchema.parse(transcriptDrafts);

  // Imported turns intentionally reuse the same replay-local append path as
  // hand-entered turns so seeded mock turns remain distinct from replay-local
  // additions, while replay still has only one ordered event stream.
  return parsedTranscript.reduce(
    (nextTurns, draft) => appendManualTranscriptTurn(nextTurns, sessionId, draft),
    turns,
  );
}
