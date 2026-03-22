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
};

// Use stable UUID-shaped ids so assembled debug turns can link cleanly back
// into existing transcript-oriented tooling without pretending they are
// product-authored replay turns.
const CANONICAL_TURN_ID_PREFIX = "00000000-0000-4000-8000-";

function normalizeTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildCanonicalTurnId(sequence: number) {
  return `${CANONICAL_TURN_ID_PREFIX}${sequence.toString().padStart(12, "0")}`;
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
  };
}

function buildCanonicalTurnFromFinalEvent(
  event: RawTranscriptEvent,
  draft: DraftAccumulator,
): CanonicalTurn {
  return canonicalTurnSchema.parse({
    id: buildCanonicalTurnId(event.sequence),
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
  });
}

export function assembleCanonicalTurns(rawEvents: RawTranscriptEvent[]) {
  const normalizedEvents = rawTranscriptEventSchema.array().parse(rawEvents);
  const drafts = new Map<string, DraftAccumulator>();
  const finalTurns = new Map<string, CanonicalTurn>();

  [...normalizedEvents]
    .sort(sortRawEvents)
    .forEach((event) => {
      const nextDraft = updateDraftAccumulator(drafts.get(event.utteranceKey), event);

      drafts.set(event.utteranceKey, nextDraft);

      if (event.eventType === "final") {
        finalTurns.set(
          event.utteranceKey,
          buildCanonicalTurnFromFinalEvent(event, nextDraft),
        );
        drafts.delete(event.utteranceKey);
      }
    });

  return Array.from(finalTurns.values()).sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.finalizedAt.localeCompare(right.finalizedAt);
  });
}
