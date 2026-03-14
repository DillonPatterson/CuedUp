import type { CandidateNextMove } from "@/types";

const MAX_CUE_WORDS = 8;
const BANNED_PREFIXES = [
  "consider",
  "you might",
  "ask about their",
  "it may be worth",
];
const BANNED_FRAGMENTS = ["because", "since", "so that"];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripEnginePrefixes(value: string) {
  return value
    .replace(/^Press contradiction:\s*/i, "")
    .replace(/^Probe live wire:\s*/i, "")
    .replace(/^Open vein:\s*/i, "")
    .replace(/^Deploy follow-up:\s*/i, "")
    .replace(/^Begin wrap path\s*/i, "Wrap")
    .replace(/^Let the guest breathe\s*/i, "Let it breathe");
}

export function formatCandidateCue(candidate: CandidateNextMove) {
  const formattedCue = normalizeWhitespace(stripEnginePrefixes(candidate.label));

  if (!formattedCue) {
    return null;
  }

  if (formattedCue.includes("?")) {
    return null;
  }

  const lowerValue = formattedCue.toLowerCase();

  if (BANNED_PREFIXES.some((prefix) => lowerValue.startsWith(prefix))) {
    return null;
  }

  if (BANNED_FRAGMENTS.some((fragment) => lowerValue.includes(` ${fragment} `))) {
    return null;
  }

  if (formattedCue.split(/\s+/).length > MAX_CUE_WORDS) {
    return null;
  }

  return formattedCue;
}

export const liveCueWordLimit = MAX_CUE_WORDS;
