import { z } from "zod";

export const dossierImportanceSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const dossierStatusSchema = z.enum([
  "unverified",
  "ready",
  "in_play",
  "exhausted",
  "avoid",
]);

export const dossierSensitivitySchema = z.enum([
  "low",
  "guarded",
  "sensitive",
  "volatile",
]);

export const contradictionSeveritySchema = z.enum([
  "minor",
  "moderate",
  "major",
  "critical",
]);

export const sourceReferenceTypeSchema = z.enum([
  "article",
  "podcast",
  "video",
  "social_post",
  "interview",
  "book",
  "internal_note",
  "other",
]);

export const confidenceBandSchema = z.enum([
  "speculative",
  "emerging",
  "grounded",
  "high",
]);

export const storyVeinSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  summary: z.string().min(1),
  theme: z.string().min(1),
  importance: dossierImportanceSchema,
  status: dossierStatusSchema,
  sourceRefs: z.array(z.string().uuid()).default([]),
  suggestedEntryPoints: z.array(z.string().min(1)).default([]),
  suggestedFollowUps: z.array(z.string().min(1)).default([]),
  relatedVeinIds: z.array(z.string().uuid()).default([]),
  sensitivity: dossierSensitivitySchema,
  confidence: confidenceBandSchema,
});

export const liveWireSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  whyItMatters: z.string().min(1),
  triggerPhrases: z.array(z.string().min(1)).default([]),
  suggestedApproach: z.string().min(1),
  sensitivity: dossierSensitivitySchema,
  confidence: confidenceBandSchema,
});

export const contradictionSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(1),
  statementA: z.string().min(1),
  statementB: z.string().min(1),
  sourceA: z.string().uuid(),
  sourceB: z.string().uuid(),
  severity: contradictionSeveritySchema,
  suggestedFollowUp: z.string().min(1),
  confidence: confidenceBandSchema,
});

export const unaskedTopicSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(1),
  whyUnasked: z.string().min(1),
  opportunity: z.string().min(1),
  suggestedPromptFragments: z.array(z.string().min(1)).default([]),
  confidence: confidenceBandSchema,
});

export const audienceHookSchema = z.object({
  id: z.string().uuid(),
  angle: z.string().min(1),
  targetAudience: z.string().min(1),
  whyItLands: z.string().min(1),
  suggestedUse: z.string().min(1),
});

export const openingPathSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  approach: z.string().min(1),
  whyItWorks: z.string().min(1),
  firstQuestionSeed: z.string().min(1),
});

export const followUpOpportunitySchema = z.object({
  id: z.string().uuid(),
  relatedVeinId: z.string().uuid().nullable(),
  momentType: z.enum([
    "opening",
    "pivot",
    "evasion",
    "emotion_spike",
    "contradiction",
    "wrap",
  ]),
  promptFragments: z.array(z.string().min(1)).default([]),
  whyNow: z.string().min(1),
});

export const sourceReferenceSchema = z.object({
  id: z.string().uuid(),
  type: sourceReferenceTypeSchema,
  title: z.string().min(1),
  url: z.url().nullable(),
  excerpt: z.string().min(1),
  relevance: z.string().min(1),
});

export const dossierSchema = z.object({
  id: z.string().uuid(),
  guestId: z.string().uuid(),
  title: z.string().min(1),
  guestSummary: z.string().min(1),
  storyVeins: z.array(storyVeinSchema).default([]),
  liveWires: z.array(liveWireSchema).default([]),
  contradictions: z.array(contradictionSchema).default([]),
  unaskedTopics: z.array(unaskedTopicSchema).default([]),
  overusedTopics: z.array(z.string().min(1)).default([]),
  audienceHooks: z.array(audienceHookSchema).default([]),
  openingPaths: z.array(openingPathSchema).default([]),
  followUpOpportunities: z.array(followUpOpportunitySchema).default([]),
  sourceReferences: z.array(sourceReferenceSchema).default([]),
  confidence: confidenceBandSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDossierInputSchema = dossierSchema
  .pick({
    guestId: true,
    title: true,
    guestSummary: true,
  })
  .extend({
    storyVeins: dossierSchema.shape.storyVeins.optional(),
    liveWires: dossierSchema.shape.liveWires.optional(),
    contradictions: dossierSchema.shape.contradictions.optional(),
    unaskedTopics: dossierSchema.shape.unaskedTopics.optional(),
    overusedTopics: dossierSchema.shape.overusedTopics.optional(),
    audienceHooks: dossierSchema.shape.audienceHooks.optional(),
    openingPaths: dossierSchema.shape.openingPaths.optional(),
    followUpOpportunities: dossierSchema.shape.followUpOpportunities.optional(),
    sourceReferences: dossierSchema.shape.sourceReferences.optional(),
    confidence: dossierSchema.shape.confidence.optional(),
  });

export type DossierImportance = z.infer<typeof dossierImportanceSchema>;
export type DossierStatus = z.infer<typeof dossierStatusSchema>;
export type DossierSensitivity = z.infer<typeof dossierSensitivitySchema>;
export type ContradictionSeverity = z.infer<
  typeof contradictionSeveritySchema
>;
export type SourceReferenceType = z.infer<typeof sourceReferenceTypeSchema>;
export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type StoryVein = z.infer<typeof storyVeinSchema>;
export type LiveWire = z.infer<typeof liveWireSchema>;
export type Contradiction = z.infer<typeof contradictionSchema>;
export type UnaskedTopic = z.infer<typeof unaskedTopicSchema>;
export type AudienceHook = z.infer<typeof audienceHookSchema>;
export type OpeningPath = z.infer<typeof openingPathSchema>;
export type FollowUpOpportunity = z.infer<typeof followUpOpportunitySchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type Dossier = z.infer<typeof dossierSchema>;
export type CreateDossierInput = z.infer<typeof createDossierInputSchema>;
