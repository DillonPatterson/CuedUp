import { z } from "zod";

export const nudgeTypeSchema = z.enum([
  "follow_up",
  "pivot",
  "clarify",
  "challenge",
  "wrap",
]);

export const nudgeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: nudgeTypeSchema,
  content: z.string().min(1),
  ttl: z.number().int().positive(),
  createdAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  rejectedReason: z.string().nullable(),
});

export const createNudgeInputSchema = nudgeSchema.omit({
  id: true,
  createdAt: true,
  consumedAt: true,
  rejectedReason: true,
});

export type Nudge = z.infer<typeof nudgeSchema>;
export type NudgeType = z.infer<typeof nudgeTypeSchema>;
export type CreateNudgeInput = z.infer<typeof createNudgeInputSchema>;
