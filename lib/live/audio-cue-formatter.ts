import type {
  TranscriptNextNudgeCandidate,
  TranscriptNextNudgePromptAngle,
} from "@/lib/transcript/organization/types";

export type AudioCueValidation = {
  wordCount: number;
  maxWordCount: number;
  bannedTerms: string[];
  hasQuestionMark: boolean;
  isEmpty: boolean;
  isAwkwardlyLong: boolean;
};

export type FormattedAudioCue = {
  text: string;
  validation: AudioCueValidation;
};

const ENGINE_TERMS = [
  "thread",
  "tension",
  "claim",
  "theme",
  "directive",
  "interruption",
  "cue",
  "nudge",
  "guard",
  "selector",
  "candidate",
  "replay",
  "debt",
];

const FOCUS_STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "because",
  "changed",
  "exactly",
  "feel",
  "guest",
  "made",
  "personal",
  "really",
  "still",
  "that",
  "their",
  "there",
  "what",
  "when",
  "with",
]);

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMaxWordCount(
  promptAngle: TranscriptNextNudgePromptAngle,
) {
  return promptAngle === "let_it_breathe" ||
    promptAngle === "return_to_interruption"
    ? 3
    : 5;
}

function truncateWords(value: string, maxWords: number) {
  return normalizeWords(value)
    .split(" ")
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function extractFocusWords(
  label: string,
  maxWords: number,
) {
  return normalizeWords(label)
    .split(" ")
    .filter(
      (word) =>
        word.length >= 4 &&
        !FOCUS_STOPWORDS.has(word) &&
        !ENGINE_TERMS.includes(word),
    )
    .slice(0, maxWords)
    .join(" ");
}

function buildCueText(candidate: TranscriptNextNudgeCandidate) {
  const maxWordCount = getMaxWordCount(candidate.promptAngle);
  const defaultFocus = extractFocusWords(candidate.label, 3);

  switch (candidate.promptAngle) {
    case "circle_back":
      return truncateWords(
        defaultFocus ? `back to ${defaultFocus}` : "back to that",
        maxWordCount,
      );
    case "press_gently":
      return truncateWords(
        defaultFocus ? `stay with ${defaultFocus}` : "stay with that",
        maxWordCount,
      );
    case "clarify":
      return truncateWords(
        defaultFocus ? `clarify ${defaultFocus}` : "clarify that",
        maxWordCount,
      );
    case "let_it_breathe":
      return "let that breathe";
    case "return_to_interruption":
      return "go back there";
    case "test_contradiction":
      return truncateWords(
        defaultFocus ? `check ${defaultFocus}` : "check that gap",
        maxWordCount,
      );
  }
}

function validateCueText(
  text: string,
  maxWordCount: number,
): AudioCueValidation {
  const normalizedText = text.trim();
  const loweredText = normalizeWords(normalizedText);
  const words = loweredText.split(" ").filter(Boolean);
  const bannedTerms = ENGINE_TERMS.filter((term) =>
    loweredText.split(" ").includes(term),
  );

  return {
    wordCount: words.length,
    maxWordCount,
    bannedTerms,
    hasQuestionMark: normalizedText.includes("?"),
    isEmpty: normalizedText.length === 0,
    isAwkwardlyLong: words.length > maxWordCount,
  };
}

export function formatAudioCue(
  candidate: TranscriptNextNudgeCandidate | null,
): FormattedAudioCue | null {
  if (!candidate) {
    return null;
  }

  const maxWordCount = getMaxWordCount(candidate.promptAngle);
  const text = buildCueText(candidate).replace(/\?/g, "").trim();

  return {
    text,
    validation: validateCueText(text, maxWordCount),
  };
}
