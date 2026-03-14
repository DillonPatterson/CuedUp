import type { DossierGenerationInput } from "@/lib/dossier/contracts";

const requiredOutputKeys = [
  "id",
  "guestId",
  "title",
  "guestSummary",
  "storyVeins",
  "liveWires",
  "contradictions",
  "unaskedTopics",
  "overusedTopics",
  "audienceHooks",
  "openingPaths",
  "followUpOpportunities",
  "sourceReferences",
  "confidence",
  "createdAt",
  "updatedAt",
];

export const dossierPromptContract = {
  systemInstruction: `
You are generating a structured interview-prep dossier for a human operator.
Your job is not to flatter the guest or summarize loosely. Your job is to identify the strongest narrative lanes, pressure points, contradictions, emotional live wires, underexplored questions, and concrete opening and follow-up moves.
Only use information grounded in the supplied sources. When evidence is thin, lower confidence rather than inventing certainty.
Return strict JSON only. No markdown, no commentary, no extra keys.
`.trim(),
  extractionRules: [
    "Anchor every important claim to one or more source references that appear in sourceReferences.",
    "Story veins are the core unit. Each vein should represent a real lane that could sustain several minutes of live interview.",
    "Contradictions should capture genuine tension, not superficial wording differences.",
    "Live wires should identify emotionally or reputationally charged material that needs careful timing.",
    "Unasked topics should surface meaningful gaps in prior coverage, especially where stakes are high.",
    "Opening paths should give the host distinct ways to start the conversation with different tonal bets.",
    "Follow-up opportunities should be short, reusable fragments that can activate during live turns.",
    "Prefer concise, high-signal phrasing over generic research language.",
    "Use only the allowed enum values for importance, status, sensitivity, severity, source type, and confidence.",
    "All IDs must be UUID strings and all timestamps must be ISO 8601 datetime strings.",
  ],
  outputRequirements: {
    format: "Strict JSON object matching the dossier schema exactly.",
    requiredKeys: requiredOutputKeys,
    storyVeins:
      "Provide at least 3 veins when the source set supports it. Each vein should feel interviewable, not just descriptive.",
    contradictions:
      "Include only contradictions that would justify an on-air follow-up. Tie each side to source IDs.",
    liveWires:
      "Capture emotionally live or reputationally risky material with clear trigger phrases and a careful approach.",
    unaskedTopics:
      "Surface coverage gaps that create real opportunity for original reporting or revealing conversation.",
    openingPaths:
      "Give at least 2 distinct opening options with clear rationale and the first question seed.",
    followUpOpportunities:
      "Make fragments short and reusable so they can slot into a live interview state machine later.",
  },
  sectionGuidance: {
    storyVeins:
      "Choose the few threads that most clearly organize the guest's story, motives, conflict, and stakes.",
    contradictions:
      "Prioritize contradictions between self-description, strategic claims, and observed behavior.",
    liveWires:
      "Flag topics where timing, tone, and sequencing matter because the guest may shut down or reveal something consequential.",
    unaskedTopics:
      "Look for meaningful areas that prior interviewers avoided, softened, or left at the headline level.",
    openingPaths:
      "Offer one human opening and one pressure-tested opening when the material allows it.",
    followUpOpportunities:
      "Create fragments the host can deploy after evasion, emotional opening, contradiction, or a revealing detail.",
  },
} as const;

export function buildDossierInputSummary(input: DossierGenerationInput) {
  const sourceLines = input.sources.map((source) => {
    const urlPart = source.url ? ` (${source.url})` : "";
    return `- [${source.mode}] ${source.title}${urlPart}: ${source.content}`;
  });

  return [
    `Guest: ${input.guestName}`,
    `Guest ID: ${input.guestId}`,
    `Slug: ${input.guestSlug}`,
    `Dossier title: ${input.title}`,
    `Interview focus: ${input.interviewFocus}`,
    input.notes ? `Operator notes: ${input.notes}` : null,
    "Sources:",
    ...sourceLines,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDossierPrompt(input: DossierGenerationInput) {
  return [
    "SYSTEM INSTRUCTION",
    dossierPromptContract.systemInstruction,
    "",
    "DEVELOPER RULES",
    ...dossierPromptContract.extractionRules.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    "OUTPUT REQUIREMENTS",
    `Required top-level keys: ${dossierPromptContract.outputRequirements.requiredKeys.join(", ")}`,
    `Story veins: ${dossierPromptContract.outputRequirements.storyVeins}`,
    `Contradictions: ${dossierPromptContract.outputRequirements.contradictions}`,
    `Live wires: ${dossierPromptContract.outputRequirements.liveWires}`,
    `Unasked topics: ${dossierPromptContract.outputRequirements.unaskedTopics}`,
    `Opening paths: ${dossierPromptContract.outputRequirements.openingPaths}`,
    `Follow-up opportunities: ${dossierPromptContract.outputRequirements.followUpOpportunities}`,
    "",
    "SECTION GUIDANCE",
    `Story veins: ${dossierPromptContract.sectionGuidance.storyVeins}`,
    `Contradictions: ${dossierPromptContract.sectionGuidance.contradictions}`,
    `Live wires: ${dossierPromptContract.sectionGuidance.liveWires}`,
    `Unasked topics: ${dossierPromptContract.sectionGuidance.unaskedTopics}`,
    `Opening paths: ${dossierPromptContract.sectionGuidance.openingPaths}`,
    `Follow-up opportunities: ${dossierPromptContract.sectionGuidance.followUpOpportunities}`,
    "",
    "INPUT SUMMARY",
    buildDossierInputSummary(input),
  ].join("\n");
}
