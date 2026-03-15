import { z } from "zod";
import {
  transcriptTurnInputSchema,
  transcriptTurnSchema,
} from "@/lib/schemas/transcript";
import {
  analyzeReplayCommittedTurn,
  type ReplayAffectiveIntensity,
  type ReplayCompletionReason,
  type ReplayCompletionStatus,
  type ReplayDominantEmotion,
  type ReplayInterruptionReason,
  type ReplayLexicalHit,
  type ReplayValence,
  type ReplayTurnAnalysis,
} from "@/lib/transcript/turn-analysis";
import {
  extractReplayTurnMemory,
  type ReplayTurnMemory,
} from "@/lib/transcript/turn-memory";
import type { TranscriptTurn, TranscriptTurnInput } from "@/types";

export const replayTurnSourceSchema = z.enum([
  "manual_replay_input",
  "json_import",
  "listening_sandbox_draft",
  "listening_sandbox_segment",
  "future_live_ingestion",
  "fixture_load",
]);

export type ReplayTurnInputSource = z.infer<typeof replayTurnSourceSchema>;

export type ReplayTranscriptTurnDraft = Omit<
  TranscriptTurnInput,
  "sessionId" | "timestamp" | "threadIdLink"
> & {
  source: ReplayTurnInputSource;
  threadIdLink?: string | null;
};

export type ManualTranscriptTurnDraft = Omit<ReplayTranscriptTurnDraft, "source">;

export type ReplayCommittedTurnMetadata = {
  source: ReplayTurnInputSource;
  label: string;
  analysis: ReplayTurnAnalysis;
  memory: ReplayTurnMemory;
};

export type ReplayAppendResult = {
  turns: TranscriptTurn[];
  appendedTurns: TranscriptTurn[];
  metadata: Record<string, ReplayCommittedTurnMetadata>;
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

const replayTurnSourceLabels: Record<ReplayTurnInputSource, string> = {
  manual_replay_input: "Manual replay input",
  json_import: "JSON import",
  listening_sandbox_draft: "Listening sandbox draft",
  listening_sandbox_segment: "Listening sandbox segment",
  future_live_ingestion: "Future live ingestion",
  fixture_load: "Fixture load",
};

const replayTranscriptTurnDraftSchema = z.object({
  source: replayTurnSourceSchema,
  speaker: transcriptTurnInputSchema.shape.speaker.default(
    REPLAY_IMPORT_DEFAULTS.speaker,
  ),
  text: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Replay transcript turn text cannot be empty.")),
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

const replayCommittedTurnMetadataSchema = z.object({
  source: replayTurnSourceSchema,
  label: z.string().min(1),
  analysis: z.object({
    turnKind: z.enum([
      "question",
      "answer",
      "producer_note",
      "system_note",
      "statement",
    ]),
    specificityBand: z.enum(["low", "medium", "high"]),
    emotionalSignal: z.enum(["flat", "engaged", "heated"]),
    threadAction: z.enum(["none", "opens", "revisits", "linked", "deflects"]),
    cuePotential: z.enum(["low", "medium", "high"]),
    affective: z.object({
      dominantEmotion: z.enum([
        "neutral",
        "regret",
        "fear",
        "anger",
        "sadness",
        "defensiveness",
      ] satisfies [ReplayDominantEmotion, ...ReplayDominantEmotion[]]),
      intensity: z.enum([
        "low",
        "medium",
        "high",
      ] satisfies [ReplayAffectiveIntensity, ...ReplayAffectiveIntensity[]]),
      valence: z.enum([
        "negative",
        "mixed",
        "positive",
        "neutral",
      ] satisfies [ReplayValence, ...ReplayValence[]]),
      triggerTerms: z.array(
        z.object({
          term: z.string().min(1),
          tier: z.enum([
            "emotion",
            "stakes",
            "intensifier",
            "deflection",
            "dossier_story",
            "dossier_live_wire",
            "dossier_contradiction",
          ] satisfies [ReplayLexicalHit["tier"], ...ReplayLexicalHit["tier"][]]),
          weight: z.number().min(0),
          source: z.enum(["base", "dossier"]),
        }),
      ),
    }),
    completion: z.object({
      completionStatus: z.enum([
        "complete",
        "incomplete",
        "truncated",
        "uncertain",
      ] satisfies [ReplayCompletionStatus, ...ReplayCompletionStatus[]]),
      reasons: z.array(
        z.enum([
          "endsWithConnector",
          "danglingClause",
          "explicitQuestionOpen",
          "veryShortFragment",
          "endsWithDash",
          "endsWithEllipsis",
          "noTerminalPunctuation",
        ] satisfies [ReplayCompletionReason, ...ReplayCompletionReason[]]),
      ),
    }),
    interruption: z.object({
      interruptedPreviousTurn: z.boolean(),
      previousTurnId: z.string().uuid().nullable(),
      reason: z.enum([
        "unfinishedSpeakerSwitch",
        "rapidSpeakerSwitch",
        "nonIncreasingTimestamp",
        "none",
      ] satisfies [ReplayInterruptionReason, ...ReplayInterruptionReason[]]),
    }),
    lexical: z.object({
      hits: z.array(
        z.object({
          term: z.string().min(1),
          tier: z.enum([
            "emotion",
            "stakes",
            "intensifier",
            "deflection",
            "dossier_story",
            "dossier_live_wire",
            "dossier_contradiction",
          ] satisfies [ReplayLexicalHit["tier"], ...ReplayLexicalHit["tier"][]]),
          weight: z.number().min(0),
          source: z.enum(["base", "dossier"]),
        }),
      ),
      weightedScore: z.number().min(0),
    }),
  }),
  memory: z.object({
    entities: z.array(z.string()),
    themes: z.array(z.string()),
    claims: z.array(z.string()),
    contradictionSignals: z.array(z.string()),
    unresolvedThreadCues: z.array(z.string()),
    salience: z.enum(["low", "medium", "high"]),
    memoryKind: z.enum([
      "fact",
      "emotion",
      "relationship",
      "risk",
      "identity",
      "none",
    ]),
  }),
});

const replayImportedTurnSchema = replayTranscriptTurnDraftSchema.omit({
  source: true,
});

const replayImportedTranscriptSchema = z.array(replayImportedTurnSchema);
const replayCommittedTurnMetadataRecordSchema = z.record(
  z.string(),
  replayCommittedTurnMetadataSchema,
);

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

function formatReplayValidationError(
  context: string,
  error: z.ZodError,
) {
  const issue = error.issues[0];
  const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  const message = issue?.message ?? "Invalid replay transcript payload.";

  return `${context} ${path}${message}`;
}

function buildReplaySourceMetadata(
  source: ReplayTurnInputSource,
  turn: TranscriptTurn,
  previousTurn: TranscriptTurn | null,
): ReplayCommittedTurnMetadata {
  const analysis = analyzeReplayCommittedTurn(turn, {
    previousTurn,
  });

  return {
    source,
    label: replayTurnSourceLabels[source],
    analysis,
    memory: extractReplayTurnMemory(turn, analysis),
  };
}

function normalizeReplayTranscriptTurnDraft(
  draft: ReplayTranscriptTurnDraft,
) {
  const parsedDraft = replayTranscriptTurnDraftSchema.safeParse(draft);

  if (!parsedDraft.success) {
    throw new Error(
      formatReplayValidationError(
        "Replay transcript turn is invalid.",
        parsedDraft.error,
      ),
    );
  }

  return parsedDraft.data;
}

function buildTranscriptTurnFromReplayDraft(
  turns: TranscriptTurn[],
  sessionId: string,
  draft: ReplayTranscriptTurnDraft,
) {
  const normalizedDraft = normalizeReplayTranscriptTurnDraft(draft);
  const nextManualTurnCount = countManualTurns(turns);
  const input = transcriptTurnInputSchema.parse({
    sessionId,
    timestamp: buildNextTimestamp(turns),
    speaker: normalizedDraft.speaker,
    text: normalizedDraft.text,
    energyScore: normalizedDraft.energyScore,
    specificityScore: normalizedDraft.specificityScore,
    evasionScore: normalizedDraft.evasionScore,
    noveltyScore: normalizedDraft.noveltyScore,
    // Replay-only input currently exercises keyword/text matching more than
    // direct thread-linking. `threadIdLink` stays null unless a caller provides it.
    threadIdLink: normalizedDraft.threadIdLink ?? null,
  });

  return {
    turn: transcriptTurnSchema.parse({
      ...input,
      id: buildManualTurnId(nextManualTurnCount),
    }),
  };
}

export function parseReplayCommittedTurnMetadataRecord(value: unknown) {
  const parsedMetadata =
    replayCommittedTurnMetadataRecordSchema.safeParse(value);

  return parsedMetadata.success ? parsedMetadata.data : {};
}

export function appendReplayTranscriptTurns(
  turns: TranscriptTurn[],
  sessionId: string,
  drafts: ReplayTranscriptTurnDraft[],
): ReplayAppendResult {
  return drafts.reduce<ReplayAppendResult>(
    (currentResult, draft) => {
      const { turn } = buildTranscriptTurnFromReplayDraft(
        currentResult.turns,
        sessionId,
        draft,
      );
      const metadata = buildReplaySourceMetadata(
        draft.source,
        turn,
        currentResult.turns.at(-1) ?? null,
      );

      return {
        turns: [...currentResult.turns, turn],
        appendedTurns: [...currentResult.appendedTurns, turn],
        metadata: {
          ...currentResult.metadata,
          [turn.id]: metadata,
        },
      };
    },
    {
      turns,
      appendedTurns: [],
      metadata: {},
    },
  );
}

export function appendManualTranscriptTurn(
  turns: TranscriptTurn[],
  sessionId: string,
  draft: ManualTranscriptTurnDraft,
) {
  return appendReplayTranscriptTurns(turns, sessionId, [
    {
      ...draft,
      source: "manual_replay_input",
    },
  ]).turns;
}

export function importReplayTranscriptTurns(
  turns: TranscriptTurn[],
  sessionId: string,
  rawTranscript: string,
  source: ReplayTurnInputSource = "json_import",
) {
  let parsedTranscript: unknown;

  try {
    parsedTranscript = JSON.parse(rawTranscript);
  } catch {
    throw new Error("Imported transcript must be valid JSON.");
  }

  return importReplayTranscriptTurnDrafts(turns, sessionId, parsedTranscript, source);
}

export function importReplayTranscriptTurnDrafts(
  turns: TranscriptTurn[],
  sessionId: string,
  transcriptDrafts: unknown,
  source: ReplayTurnInputSource = "json_import",
) {
  const parsedTranscript =
    replayImportedTranscriptSchema.safeParse(transcriptDrafts);

  if (!parsedTranscript.success) {
    throw new Error(
      formatReplayValidationError(
        "Imported replay transcript is invalid.",
        parsedTranscript.error,
      ),
    );
  }

  // Imported turns intentionally reuse the same replay-local append path as
  // hand-entered turns so seeded mock turns remain distinct from replay-local
  // additions, while replay still has only one ordered event stream.
  return appendReplayTranscriptTurns(
    turns,
    sessionId,
    parsedTranscript.data.map((draft) => ({
      ...draft,
      source,
    })),
  );
}
