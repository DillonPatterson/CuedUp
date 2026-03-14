import { z } from "zod";

export const conversationModeSchema = z.enum([
  "explore",
  "tighten",
  "challenge",
  "wrap",
]);

export const conversationThreadSourceSchema = z.enum([
  "story_vein",
  "live_wire",
  "contradiction",
]);

export const conversationThreadStatusSchema = z.enum([
  "seeded",
  "active",
  "cooling",
  "resolved",
]);

export const candidateNextMoveTypeSchema = z.enum([
  "open_vein",
  "probe_live_wire",
  "press_contradiction",
  "deploy_follow_up",
  "let_breathe",
  "wrap",
]);

export const conversationThreadSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  source: conversationThreadSourceSchema,
  status: conversationThreadStatusSchema,
  relatedVeinId: z.string().uuid().nullable(),
  keywords: z.array(z.string().min(1)).default([]),
  saturation: z.number().min(0).max(1),
  touchCount: z.number().int().nonnegative(),
  lastTouchedAt: z.string().datetime().nullable(),
  lastSpeaker: z.enum(["host", "guest", "producer", "system"]).nullable(),
});

export const candidateNextMoveSchema = z.object({
  id: z.string().min(1),
  type: candidateNextMoveTypeSchema,
  threadId: z.string().uuid().nullable(),
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: z.number().min(0).max(1),
  promptFragment: z.string().nullable(),
});

export const conversationStateSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  coveredVeins: z.array(z.string().uuid()).default([]),
  activeThreads: z.array(z.string().uuid()).default([]),
  emotionalHeat: z.number().min(0).max(1),
  closureConfidence: z.number().min(0).max(1),
  currentMode: conversationModeSchema,
  threads: z.array(conversationThreadSchema).default([]),
  candidateNextMoves: z.array(candidateNextMoveSchema).default([]),
  recentNudgeKeys: z.array(z.string().min(1)).default([]),
  lastProcessedTurnId: z.string().uuid().nullable(),
  turnCount: z.number().int().nonnegative().default(0),
  lastMeaningfulShiftAt: z.string().datetime().nullable(),
  staleNudgeGuard: z.boolean().default(false),
  updatedAt: z.string().datetime(),
});

export type ConversationMode = z.infer<typeof conversationModeSchema>;
export type ConversationThreadSource = z.infer<
  typeof conversationThreadSourceSchema
>;
export type ConversationThreadStatus = z.infer<
  typeof conversationThreadStatusSchema
>;
export type CandidateNextMoveType = z.infer<
  typeof candidateNextMoveTypeSchema
>;
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
export type CandidateNextMove = z.infer<typeof candidateNextMoveSchema>;
export type ConversationState = z.infer<typeof conversationStateSchema>;
