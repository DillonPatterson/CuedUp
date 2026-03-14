import { z } from "zod";

export const transcriptTurnSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  speaker: z.enum(["host", "guest", "producer", "system"]),
  text: z.string().min(1),
  energyScore: z.number().min(0).max(1),
  specificityScore: z.number().min(0).max(1),
  evasionScore: z.number().min(0).max(1),
  noveltyScore: z.number().min(0).max(1),
  threadIdLink: z.string().uuid().nullable(),
});

export const transcriptTurnInputSchema = transcriptTurnSchema
  .omit({
    id: true,
  })
  .extend({
    timestamp: z.string().datetime().optional(),
  });

export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type TranscriptTurnInput = z.infer<typeof transcriptTurnInputSchema>;
