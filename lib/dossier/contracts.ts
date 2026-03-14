import { z } from "zod";

export const sourceInputModeSchema = z.enum([
  "pasted_text",
  "url",
  "notes",
  "transcript_excerpt",
]);

export const dossierSourceItemSchema = z.object({
  id: z.string().uuid(),
  mode: sourceInputModeSchema,
  title: z.string().min(1),
  url: z.string().url().nullable().optional(),
  content: z.string().min(1),
  notes: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
});

export const dossierGenerationInputSchema = z.object({
  guestId: z.string().uuid(),
  guestSlug: z.string().min(1),
  guestName: z.string().min(1),
  title: z.string().min(1),
  interviewFocus: z.string().min(1),
  notes: z.string().default(""),
  sources: z.array(dossierSourceItemSchema).min(1),
});

export const dossierRequestSchema = z
  .object({
    guestId: z.string().min(1).optional(),
    guestSlug: z.string().min(1).optional(),
    guestName: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    interviewFocus: z.string().min(1).optional(),
    notes: z.string().optional(),
    sources: z.array(dossierSourceItemSchema).optional(),
  })
  .refine((value) => value.guestId || value.guestSlug || value.sources, {
    message: "Provide guestId, guestSlug, or sources to generate a dossier.",
    path: ["guestId"],
  });

export type SourceInputMode = z.infer<typeof sourceInputModeSchema>;
export type DossierSourceItem = z.infer<typeof dossierSourceItemSchema>;
export type DossierGenerationInput = z.infer<
  typeof dossierGenerationInputSchema
>;
export type DossierRequest = z.infer<typeof dossierRequestSchema>;
