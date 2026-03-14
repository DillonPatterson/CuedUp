import type { DossierGenerationInput } from "@/lib/dossier/contracts";
import type { Dossier } from "@/types";

function findSourceId(input: DossierGenerationInput, keyword: string) {
  return (
    input.sources.find((source) => {
      const haystack = `${source.title} ${source.content} ${source.notes ?? ""}`
        .toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    })?.id ?? input.sources[0]?.id
  );
}

export function buildMockDossier(input: DossierGenerationInput): Dossier {
  const contradictionSourceA =
    findSourceId(input, "never wanted to run a public company") ??
    input.sources[0].id;
  const contradictionSourceB =
    findSourceId(input, "public scrutiny would sharpen the mission") ??
    input.sources.at(1)?.id ??
    input.sources[0].id;
  const emotionalSourceId =
    findSourceId(input, "brother") ?? input.sources.at(2)?.id ?? input.sources[0].id;
  const laborSourceId =
    findSourceId(input, "labor") ??
    findSourceId(input, "workers") ??
    input.sources.at(1)?.id ??
    input.sources[0].id;

  const storyVeinIds = {
    reinvention: "51111111-1111-4111-8111-111111111111",
    accountability: "52222222-2222-4222-8222-222222222222",
    privateCost: "53333333-3333-4333-8333-333333333333",
  };

  return {
    id: "41111111-1111-4111-8111-111111111111",
    guestId: input.guestId,
    title: input.title,
    guestSummary:
      `${input.guestName} is a systems-minded founder whose public arguments about resilience are inseparable from a more personal story about collapse, recovery, and the cost of scaling under scrutiny.`,
    storyVeins: [
      {
        id: storyVeinIds.reinvention,
        title: "Reinvention after collapse",
        summary:
          `${input.guestName} repeatedly frames her leadership through the lens of growing up around institutional failure, which gives the interview a strong origin-story spine.`,
        theme: "reinvention",
        importance: "high",
        status: "ready",
        sourceRefs: [input.sources[0].id, input.sources[2].id],
        suggestedEntryPoints: [
          "When did resilience stop being an abstract idea and become a personal rule?",
          "What did growing up around the mill closure teach you about systems failure?",
        ],
        suggestedFollowUps: [
          "What part of that town still travels with you into boardrooms?",
          "Where does your reinvention story get romanticized too easily?",
        ],
        relatedVeinIds: [storyVeinIds.privateCost],
        sensitivity: "guarded",
        confidence: "grounded",
      },
      {
        id: storyVeinIds.accountability,
        title: "Public accountability versus mission control",
        summary:
          "Her language around public markets shifts depending on context, which makes this the cleanest pressure-tested vein in the prep material.",
        theme: "accountability",
        importance: "critical",
        status: "ready",
        sourceRefs: [contradictionSourceA, contradictionSourceB],
        suggestedEntryPoints: [
          "You have described public markets as theater and as a sharpening force. What changed?",
          "How do you know when transparency is helping the mission versus distorting it?",
        ],
        suggestedFollowUps: [
          "Was the real pivot strategic, financial, or emotional?",
          "Who paid the cost when the company moved faster than your instincts wanted?",
        ],
        relatedVeinIds: [storyVeinIds.reinvention, storyVeinIds.privateCost],
        sensitivity: "sensitive",
        confidence: "high",
      },
      {
        id: storyVeinIds.privateCost,
        title: "The private cost behind the public mission",
        summary:
          `The material hints that ${input.guestName}'s family history, especially her brother's relapse, is the emotional thread that makes her language about risk feel real rather than performative.`,
        theme: "personal stakes",
        importance: "high",
        status: "in_play",
        sourceRefs: [emotionalSourceId],
        suggestedEntryPoints: [
          "You rarely speak about your brother, but it seems tied to how you define risk. Why?",
          "What became non-negotiable for you after that period?",
        ],
        suggestedFollowUps: [
          "What are people missing when they call your work purely technical?",
          "How has grief made you harder to impress and harder to fool?",
        ],
        relatedVeinIds: [storyVeinIds.reinvention],
        sensitivity: "volatile",
        confidence: "emerging",
      },
    ],
    liveWires: [
      {
        id: "61111111-1111-4111-8111-111111111111",
        label: "Brother's relapse as the hidden risk lens",
        whyItMatters:
          "It appears to be the most emotionally loaded explanation for why reliability language matters so much to her.",
        triggerPhrases: ["risk stopped feeling theoretical", "my brother", "fragility"],
        suggestedApproach:
          "Move slowly and invite reflection rather than forcing disclosure. If she opens the door, stay with meaning before chasing detail.",
        sensitivity: "volatile",
        confidence: "grounded",
      },
      {
        id: "62222222-2222-4222-8222-222222222222",
        label: "Nevada restructuring and worker trust",
        whyItMatters:
          "This is the most obvious pressure point where her mission language may have collided with operational reality.",
        triggerPhrases: ["restructuring", "workers felt blindsided", "board deck"],
        suggestedApproach:
          "Use concrete chronology. Ask what workers heard, when they heard it, and what she would redo now.",
        sensitivity: "sensitive",
        confidence: "high",
      },
    ],
    contradictions: [
      {
        id: "71111111-1111-4111-8111-111111111111",
        topic: "Public company ambition",
        statementA:
          "She said she never wanted to run a public company because public markets reward theater.",
        statementB:
          "She later argued that public scrutiny would sharpen the mission and expand what the company could protect.",
        sourceA: contradictionSourceA,
        sourceB: contradictionSourceB,
        severity: "major",
        suggestedFollowUp:
          "What specifically changed between distrusting the stage and deciding the stage could serve the mission?",
        confidence: "high",
      },
    ],
    unaskedTopics: [
      {
        id: "81111111-1111-4111-8111-111111111111",
        topic: "Worker communication during restructuring",
        whyUnasked:
          "Coverage mentions the board leak and employee frustration, but no interview source presses her on the human sequence.",
        opportunity:
          "It can reveal whether her ethics of resilience hold up when trust becomes procedural rather than rhetorical.",
        suggestedPromptFragments: [
          "Who heard the news first?",
          "What did the plant floor understand before leadership explained it?",
        ],
        confidence: "high",
      },
      {
        id: "82222222-2222-4222-8222-222222222222",
        topic: "How family trauma changed leadership style",
        whyUnasked:
          "Sources gesture at it but stop before connecting private pain to executive judgment.",
        opportunity:
          "Handled carefully, it could unlock the deepest explanation for her obsession with reliability and control.",
        suggestedPromptFragments: [
          "What part of your leadership style became less theoretical after your brother's relapse?",
          "What do you notice in yourself when risk becomes personal?",
        ],
        confidence: "grounded",
      },
    ],
    overusedTopics: [
      "generic climate-founder optimism",
      "surface-level resilience branding",
    ],
    audienceHooks: [
      {
        id: "91111111-1111-4111-8111-111111111111",
        angle: "A founder who distrusts performance but ended up on a public stage anyway",
        targetAudience: "business and policy listeners",
        whyItLands:
          "It creates immediate tension between mission purity and institutional scale.",
        suggestedUse: "Use in the intro and again when pressing the contradiction vein.",
      },
      {
        id: "92222222-2222-4222-8222-222222222222",
        angle: "Reliability as a deeply personal, not just technical, obsession",
        targetAudience: "general long-form interview audience",
        whyItLands:
          "It reframes infrastructure talk around lived stakes and grief rather than jargon.",
        suggestedUse: "Use when transitioning from origin story to emotional stakes.",
      },
    ],
    openingPaths: [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        label: "Origin through collapse",
        approach:
          "Open with the mill closure and let her define resilience before mentioning the company.",
        whyItWorks:
          "It starts human, not corporate, and naturally tees up the strongest story vein.",
        firstQuestionSeed:
          "What did that town teach you about what breaks first when a system fails?",
      },
      {
        id: "a2222222-2222-4222-8222-222222222222",
        label: "Contradiction-first accountability",
        approach:
          "Start with the tension between distrusting public markets and later embracing public scrutiny.",
        whyItWorks:
          "It signals seriousness early and lets the interview establish intellectual stakes fast.",
        firstQuestionSeed:
          "You once said you never wanted to run a public company, then later said public scrutiny sharpened the mission. Which version of you was more honest?",
      },
    ],
    followUpOpportunities: [
      {
        id: "b1111111-1111-4111-8111-111111111111",
        relatedVeinId: storyVeinIds.reinvention,
        momentType: "opening",
        promptFragments: [
          "What detail from the mill closure never leaves you?",
          "When did resilience become moral language for you?",
        ],
        whyNow:
          "Use after a clean origin answer to deepen the vein before the conversation gets abstract.",
      },
      {
        id: "b2222222-2222-4222-8222-222222222222",
        relatedVeinId: storyVeinIds.accountability,
        momentType: "contradiction",
        promptFragments: [
          "Who persuaded you scale required visibility?",
          "What did you give up when you accepted the public stage?",
        ],
        whyNow:
          "Use the moment she rationalizes the contradiction too quickly or hides behind mission language.",
      },
      {
        id: "b3333333-3333-4333-8333-333333333333",
        relatedVeinId: storyVeinIds.privateCost,
        momentType: "emotion_spike",
        promptFragments: [
          "What became intolerable after your brother's relapse?",
          "How did that experience alter your tolerance for preventable failure?",
        ],
        whyNow:
          "Use only if she signals openness and the conversation has already earned some trust.",
      },
    ],
    sourceReferences: input.sources.map((source) => ({
      id: source.id,
      type:
        source.mode === "pasted_text"
          ? "internal_note"
          : source.mode === "url"
            ? "article"
            : source.mode === "transcript_excerpt"
              ? "interview"
              : source.mode === "notes"
                ? "internal_note"
                : "other",
      title: source.title,
      url: source.url ?? null,
      excerpt: source.content.slice(0, 220),
      relevance:
        source.id === emotionalSourceId
          ? "Supports the emotionally live thread and private-cost vein."
          : source.id === laborSourceId
            ? "Supports labor-trust questions and underexplored restructuring follow-up."
            : source.id === contradictionSourceA || source.id === contradictionSourceB
              ? "Supports the cleanest public-accountability contradiction."
              : "Provides background context for the core prep narrative.",
    })),
    confidence: "grounded",
    createdAt: "2026-03-13T16:00:00.000Z",
    updatedAt: "2026-03-13T16:00:00.000Z",
  };
}
