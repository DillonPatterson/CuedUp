import { z } from "zod";

const sessionSpeakerSchema = z.enum(["host", "guest", "producer", "system"]);

export const rawTranscriptEventSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  utteranceKey: z.string().min(1),
  source: z.enum([
    "sandbox_partial",
    "sandbox_final",
    "stored_draft",
  ]),
  eventType: z.enum(["partial", "final"]),
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
  text: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable(),
  speaker: sessionSpeakerSchema.nullable(),
  speakerConfidence: z.number().min(0).max(1).nullable(),
});

export const canonicalTurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  utteranceKey: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  text: z.string().min(1),
  startedAt: z.string().datetime(),
  finalizedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1).nullable(),
  speaker: sessionSpeakerSchema.nullable(),
  speakerConfidence: z.number().min(0).max(1).nullable(),
  sourceEventIds: z.array(z.string().min(1)).min(1),
});

export const threadMentionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  threadKey: z.string().min(1),
  label: z.string().min(1),
  mentionKind: z.enum(["theme", "claim", "thread_cue", "tension"]),
  turnId: z.string().min(1),
  turnSequence: z.number().int().nonnegative(),
  excerpt: z.string().min(1),
  salience: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime(),
});

export const sessionThreadSchema = z.object({
  sessionId: z.string().min(1),
  threadKey: z.string().min(1),
  label: z.string().min(1),
  sourceKind: z.enum(["theme", "claim", "thread_cue", "tension"]),
  status: z.enum(["open", "cooling", "resolved"]),
  debtScore: z.number().int().min(0).max(10),
  dropScore: z.number().min(0),
  mentionTurnIds: z.array(z.string().min(1)).min(1),
  mentionCount: z.number().int().positive(),
  openedAtTurnId: z.string().min(1),
  lastMentionTurnId: z.string().min(1),
  lastMentionAt: z.string().datetime(),
  resolutionConfidence: z.number().min(0).max(1),
  interrupted: z.boolean(),
  affectiveWeight: z.enum(["low", "medium", "high"]),
});

export const sessionRetrievalQuerySchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum([
    "unresolved_threads",
    "most_dropped_thread",
    "thread_by_key",
    "reactivation_candidates",
    "turns_for_thread",
  ]),
  threadKey: z.string().min(1).optional(),
});

export const sessionRetrievalResultSchema = z.object({
  query: sessionRetrievalQuerySchema,
  threads: z.array(sessionThreadSchema),
  turns: z.array(canonicalTurnSchema),
  mentions: z.array(threadMentionSchema),
});

export const sessionMemoryStoreSchema = z.object({
  sessionId: z.string().min(1),
  session_events: z.array(rawTranscriptEventSchema),
  session_turns: z.array(canonicalTurnSchema),
  session_thread_mentions: z.array(threadMentionSchema),
  session_threads: z.array(sessionThreadSchema),
});

export type RawTranscriptEvent = z.infer<typeof rawTranscriptEventSchema>;
export type CanonicalTurn = z.infer<typeof canonicalTurnSchema>;
export type ThreadMention = z.infer<typeof threadMentionSchema>;
export type SessionThread = z.infer<typeof sessionThreadSchema>;
export type SessionRetrievalQuery = z.infer<typeof sessionRetrievalQuerySchema>;
export type SessionRetrievalResult = z.infer<typeof sessionRetrievalResultSchema>;
export type SessionMemoryStore = z.infer<typeof sessionMemoryStoreSchema>;
