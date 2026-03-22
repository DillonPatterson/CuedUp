import {
  canonicalTurnSchema,
  rawTranscriptEventSchema,
  type CanonicalTurn,
  type RawTranscriptEvent,
} from "@/lib/session-memory/contracts";

type DraftAccumulator = {
  sessionId: string;
  utteranceKey: string;
  startedAt: string;
  latestText: string;
  latestConfidence: number | null;
  speaker: RawTranscriptEvent["speaker"];
  speakerConfidence: number | null;
  sourceEventIds: string[];
  partialEventCount: number;
  finalEventCount: number;
  finalSequence: number | null;
};

type FinalizedUtterance = {
  sessionId: string;
  utteranceKey: string;
  sequence: number;
  text: string;
  startedAt: string;
  finalizedAt: string;
  confidence: number | null;
  speaker: RawTranscriptEvent["speaker"];
  speakerConfidence: number | null;
  sourceEventIds: string[];
  partialEventCount: number;
  finalEventCount: number;
};

type CanonicalTurnDraft = {
  sessionId: string;
  sequence: number;
  utteranceKey: string;
  text: string;
  startedAt: string;
  finalizedAt: string;
  confidenceValues: number[];
  speaker: RawTranscriptEvent["speaker"];
  speakerConfidence: number | null;
  sourceEventIds: string[];
  sourceUtteranceKeys: string[];
  partialEventCount: number;
  finalEventCount: number;
};

// Use stable UUID-shaped ids so assembled debug turns can link cleanly back
// into existing transcript-oriented tooling without pretending they are
// product-authored replay turns.
const CANONICAL_TURN_ID_PREFIX = "00000000-0000-4000-8000-";
const VERY_SHORT_TURN_WORD_LIMIT = 4;
const TURN_COMPLETION_WORD_TARGET = 10;
const TURN_LENGTH_CAP = 48;
const LONG_UTTERANCE_MERGE_GAP_MS = 4500;
const SHORT_CONTINUATION_GAP_MS = 1800;

function normalizeTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  return normalizeTranscript(value).split(/\s+/).filter(Boolean).length;
}

function buildCanonicalTurnId(sequence: number) {
  return `${CANONICAL_TURN_ID_PREFIX}${sequence.toString().padStart(12, "0")}`;
}

function hasTerminalBoundary(value: string) {
  return /[.?!]["')\]]?\s*$/.test(value.trim());
}

function startsWithLowercaseContinuation(value: string) {
  return /^[a-z]/.test(value.trim());
}

function toMilliseconds(value: string) {
  return Date.parse(value);
}

function sortRawEvents(left: RawTranscriptEvent, right: RawTranscriptEvent) {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt.localeCompare(right.occurredAt);
  }

  if (left.eventType !== right.eventType) {
    return left.eventType === "partial" ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function updateDraftAccumulator(
  current: DraftAccumulator | undefined,
  event: RawTranscriptEvent,
): DraftAccumulator {
  const normalizedText = normalizeTranscript(event.text);

  if (!current) {
    return {
      sessionId: event.sessionId,
      utteranceKey: event.utteranceKey,
      startedAt: event.occurredAt,
      latestText: normalizedText,
      latestConfidence: event.confidence,
      speaker: event.speaker,
      speakerConfidence: event.speakerConfidence,
      sourceEventIds: [event.id],
      partialEventCount: event.eventType === "partial" ? 1 : 0,
      finalEventCount: event.eventType === "final" ? 1 : 0,
      finalSequence: event.eventType === "final" ? event.sequence : null,
    };
  }

  return {
    sessionId: current.sessionId,
    utteranceKey: current.utteranceKey,
    startedAt:
      current.startedAt.localeCompare(event.occurredAt) <= 0
        ? current.startedAt
        : event.occurredAt,
    latestText: normalizedText || current.latestText,
    latestConfidence:
      event.confidence === null ? current.latestConfidence : event.confidence,
    speaker: event.speaker ?? current.speaker,
    speakerConfidence:
      event.speakerConfidence === null
        ? current.speakerConfidence
        : event.speakerConfidence,
    sourceEventIds: [...current.sourceEventIds, event.id],
    partialEventCount:
      current.partialEventCount + (event.eventType === "partial" ? 1 : 0),
    finalEventCount:
      current.finalEventCount + (event.eventType === "final" ? 1 : 0),
    finalSequence:
      event.eventType === "final" ? event.sequence : current.finalSequence,
  };
}

function buildFinalizedUtterance(
  event: RawTranscriptEvent,
  draft: DraftAccumulator,
): FinalizedUtterance {
  return {
    sessionId: event.sessionId,
    utteranceKey: event.utteranceKey,
    sequence: event.sequence,
    text: normalizeTranscript(event.text || draft.latestText),
    startedAt: draft.startedAt,
    finalizedAt: event.occurredAt,
    confidence:
      event.confidence === null ? draft.latestConfidence : event.confidence,
    speaker: event.speaker ?? draft.speaker,
    speakerConfidence:
      event.speakerConfidence === null
        ? draft.speakerConfidence
        : event.speakerConfidence,
    sourceEventIds: [...draft.sourceEventIds],
    partialEventCount: draft.partialEventCount,
    finalEventCount: Math.max(1, draft.finalEventCount),
  };
}

function createCanonicalDraft(
  utterance: FinalizedUtterance,
): CanonicalTurnDraft {
  return {
    sessionId: utterance.sessionId,
    sequence: utterance.sequence,
    utteranceKey: utterance.utteranceKey,
    text: utterance.text,
    startedAt: utterance.startedAt,
    finalizedAt: utterance.finalizedAt,
    confidenceValues:
      utterance.confidence === null ? [] : [utterance.confidence],
    speaker: utterance.speaker,
    speakerConfidence: utterance.speakerConfidence,
    sourceEventIds: [...utterance.sourceEventIds],
    sourceUtteranceKeys: [utterance.utteranceKey],
    partialEventCount: utterance.partialEventCount,
    finalEventCount: utterance.finalEventCount,
  };
}

function averageConfidence(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);

  return Number((sum / values.length).toFixed(3));
}

function shouldMergeUtterance(
  currentTurn: CanonicalTurnDraft,
  nextUtterance: FinalizedUtterance,
) {
  const currentSpeaker = currentTurn.speaker;
  const nextSpeaker = nextUtterance.speaker;

  if (
    currentSpeaker &&
    nextSpeaker &&
    currentSpeaker !== nextSpeaker
  ) {
    return {
      merge: false,
      reason: "speaker_change" as const,
    };
  }

  const gapMilliseconds = Math.max(
    0,
    toMilliseconds(nextUtterance.startedAt) - toMilliseconds(currentTurn.finalizedAt),
  );
  const currentWordCount = countWords(currentTurn.text);
  const nextWordCount = countWords(nextUtterance.text);
  const combinedWordCount = currentWordCount + nextWordCount;
  const currentHasBoundary = hasTerminalBoundary(currentTurn.text);

  if (combinedWordCount > TURN_LENGTH_CAP) {
    return {
      merge: false,
      reason: "length_cap" as const,
    };
  }

  if (gapMilliseconds > LONG_UTTERANCE_MERGE_GAP_MS) {
    return {
      merge: false,
      reason: "time_gap" as const,
    };
  }

  if (!currentHasBoundary) {
    return {
      merge: true,
      reason: "end_of_buffer" as const,
    };
  }

  if (
    currentWordCount >= 3 &&
    currentWordCount < TURN_COMPLETION_WORD_TARGET &&
    nextWordCount > VERY_SHORT_TURN_WORD_LIMIT &&
    startsWithLowercaseContinuation(nextUtterance.text) &&
    gapMilliseconds <= SHORT_CONTINUATION_GAP_MS
  ) {
    return {
      merge: true,
      reason: "end_of_buffer" as const,
    };
  }

  return {
    merge: false,
    reason: "sentence_boundary" as const,
  };
}

function mergeCanonicalDraft(
  currentTurn: CanonicalTurnDraft,
  nextUtterance: FinalizedUtterance,
) {
  return {
    ...currentTurn,
    text: normalizeTranscript(`${currentTurn.text} ${nextUtterance.text}`),
    finalizedAt: nextUtterance.finalizedAt,
    confidenceValues:
      nextUtterance.confidence === null
        ? currentTurn.confidenceValues
        : [...currentTurn.confidenceValues, nextUtterance.confidence],
    speaker: nextUtterance.speaker ?? currentTurn.speaker,
    speakerConfidence:
      nextUtterance.speakerConfidence ?? currentTurn.speakerConfidence,
    sourceEventIds: [...currentTurn.sourceEventIds, ...nextUtterance.sourceEventIds],
    sourceUtteranceKeys: [
      ...currentTurn.sourceUtteranceKeys,
      nextUtterance.utteranceKey,
    ],
    partialEventCount:
      currentTurn.partialEventCount + nextUtterance.partialEventCount,
    finalEventCount: currentTurn.finalEventCount + nextUtterance.finalEventCount,
  };
}

function buildCanonicalTurn(
  draft: CanonicalTurnDraft,
  assemblyReason: CanonicalTurn["assemblyReason"],
): CanonicalTurn {
  return canonicalTurnSchema.parse({
    id: buildCanonicalTurnId(draft.sequence),
    sessionId: draft.sessionId,
    utteranceKey: draft.utteranceKey,
    sequence: draft.sequence,
    text: draft.text,
    startedAt: draft.startedAt,
    finalizedAt: draft.finalizedAt,
    confidence: averageConfidence(draft.confidenceValues),
    speaker: draft.speaker,
    speakerConfidence: draft.speakerConfidence,
    sourceEventIds: draft.sourceEventIds,
    sourceUtteranceKeys: draft.sourceUtteranceKeys,
    partialEventCount: draft.partialEventCount,
    finalEventCount: draft.finalEventCount,
    assemblyReason,
  });
}

export function assembleCanonicalTurns(rawEvents: RawTranscriptEvent[]) {
  const normalizedEvents = rawTranscriptEventSchema.array().parse(rawEvents);
  const drafts = new Map<string, DraftAccumulator>();
  const finalizedUtterances = new Map<string, FinalizedUtterance>();

  [...normalizedEvents]
    .sort(sortRawEvents)
    .forEach((event) => {
      const nextDraft = updateDraftAccumulator(drafts.get(event.utteranceKey), event);

      drafts.set(event.utteranceKey, nextDraft);

      if (event.eventType === "final") {
        finalizedUtterances.set(
          event.utteranceKey,
          buildFinalizedUtterance(event, nextDraft),
        );
        drafts.delete(event.utteranceKey);
      }
    });

  const sortedUtterances = Array.from(finalizedUtterances.values()).sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.finalizedAt.localeCompare(right.finalizedAt);
  });
  const finalTurns: CanonicalTurn[] = [];
  let activeTurnDraft: CanonicalTurnDraft | null = null;

  sortedUtterances.forEach((utterance) => {
    if (!activeTurnDraft) {
      activeTurnDraft = createCanonicalDraft(utterance);
      return;
    }

    const mergeDecision = shouldMergeUtterance(activeTurnDraft, utterance);

    if (mergeDecision.merge) {
      activeTurnDraft = mergeCanonicalDraft(activeTurnDraft, utterance);
      return;
    }

    finalTurns.push(buildCanonicalTurn(activeTurnDraft, mergeDecision.reason));
    activeTurnDraft = createCanonicalDraft(utterance);
  });

  const trailingTurn = activeTurnDraft as CanonicalTurnDraft | null;

  if (trailingTurn !== null) {

    finalTurns.push(
      buildCanonicalTurn(
        trailingTurn,
        trailingTurn.finalEventCount === 1 &&
          trailingTurn.partialEventCount === 0
          ? "single_final"
          : "end_of_buffer",
      ),
    );
  }

  return finalTurns.sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.finalizedAt.localeCompare(right.finalizedAt);
  });
}
