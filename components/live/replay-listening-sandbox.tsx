"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { TranscriptTurn } from "@/types";
import { SessionMemoryDebugPanel } from "@/components/live/session-memory-debug-panel";
import {
  buildSessionMemoryStore,
} from "@/lib/session-memory/build-session-memory-store";
import type {
  RawTranscriptEvent,
  RawTranscriptEvent as RawTranscriptEventType,
} from "@/lib/session-memory/contracts";
import type { ReplayTranscriptTurnDraft } from "@/lib/transcript/manual-turns";
import {
  type BrowserSpeechRecognition,
  getBrowserSpeechRecognitionConstructor,
} from "@/lib/listening/browser-speech";
import { analyzeReplayCommittedTurn } from "@/lib/transcript/turn-analysis";
import { extractReplayTurnMemory } from "@/lib/transcript/turn-memory";

type ReplayListeningSandboxProps = {
  engineSessionId: string;
  replaySourceLabel: string;
  lastCommittedTurn: TranscriptTurn | null;
  onCommitDrafts: (drafts: ReplayTranscriptTurnDraft[]) => void;
};

type ListeningCommitMode = "single_turn" | "per_segment";
type ListeningScoreMode = "defaults" | "custom";
type ListeningSegmentSource = "speech_final" | "stored_draft";

type ListeningSegment = {
  id: string;
  text: string;
  source: ListeningSegmentSource;
  createdAt: string;
  wordCount: number;
};

type ListeningScoreDraft = {
  energyScore: number;
  specificityScore: number;
  evasionScore: number;
  noveltyScore: number;
};

type ListeningLastCommit = {
  committedAt: string;
  speaker: TranscriptTurn["speaker"];
  mode: ListeningCommitMode;
  turnCount: number;
  wordCount: number;
};

type SessionTranscriptEventSource =
  RawTranscriptEventType["source"];

const speakerOptions: TranscriptTurn["speaker"][] = [
  "host",
  "guest",
  "producer",
  "system",
];

const sandboxDefaults: ListeningScoreDraft = {
  energyScore: 0.55,
  specificityScore: 0.55,
  evasionScore: 0.15,
  noveltyScore: 0.45,
};

const listeningDraftStorageKey = (engineSessionId: string) =>
  `cuedup:listening-sandbox-draft:${engineSessionId}`;

type StoredListeningDraft = {
  speaker: TranscriptTurn["speaker"];
  draftText: string;
  segments: ListeningSegment[];
  commitMode: ListeningCommitMode;
  scoreMode: ListeningScoreMode;
  customScores: ListeningScoreDraft;
};

type PreviewSignalTone = "stone" | "amber" | "emerald" | "rose";

type PreviewSignal = {
  label: string;
  tone: PreviewSignalTone;
};

function normalizeTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatSignalLabel(value: string) {
  return value.replaceAll("_", " ");
}

function buildCueSignals(
  analysis: ReturnType<typeof analyzeReplayCommittedTurn>,
  memory: ReturnType<typeof extractReplayTurnMemory>,
): PreviewSignal[] {
  const signals: PreviewSignal[] = [];

  if (analysis.cuePotential !== "low") {
    signals.push({
      label: `${formatSignalLabel(analysis.cuePotential)} cue potential`,
      tone: "amber",
    });
  }

  if (analysis.threadAction !== "none") {
    signals.push({
      label: `${formatSignalLabel(analysis.threadAction)} thread`,
      tone: "stone",
    });
  }

  for (const cue of memory.unresolvedThreadCues) {
    signals.push({
      label: formatSignalLabel(cue),
      tone: "amber",
    });
  }

  for (const tension of memory.contradictionSignals) {
    signals.push({
      label: formatSignalLabel(tension),
      tone: "rose",
    });
  }

  if (analysis.interruption.interruptedPreviousTurn) {
    signals.push({
      label: "previous speaker cut off",
      tone: "rose",
    });
  }

  return Array.from(new Map(signals.map((signal) => [signal.label, signal])).values());
}

function buildIdeaSignals(
  memory: ReturnType<typeof extractReplayTurnMemory>,
): PreviewSignal[] {
  const signals: PreviewSignal[] = [];

  for (const theme of memory.themes) {
    signals.push({
      label: `theme: ${formatSignalLabel(theme)}`,
      tone: "stone",
    });
  }

  for (const entity of memory.entities) {
    signals.push({
      label: `entity: ${entity}`,
      tone: "emerald",
    });
  }

  if (memory.memoryKind !== "none") {
    signals.push({
      label: `${formatSignalLabel(memory.memoryKind)} memory`,
      tone: "stone",
    });
  }

  return Array.from(new Map(signals.map((signal) => [signal.label, signal])).values());
}

function getSignalChipClassName(tone: PreviewSignalTone) {
  switch (tone) {
    case "amber":
      return "bg-amber-100 text-amber-950";
    case "emerald":
      return "bg-emerald-100 text-emerald-950";
    case "rose":
      return "bg-rose-100 text-rose-950";
    default:
      return "bg-stone-100 text-stone-800";
  }
}

function buildDraftFromSegments(segments: ListeningSegment[]) {
  return segments.map((segment) => segment.text).join("\n");
}

function appendToDraft(currentDraft: string, addition: string) {
  const normalizedAddition = normalizeTranscript(addition);

  if (!normalizedAddition) {
    return currentDraft;
  }

  if (!currentDraft.trim()) {
    return normalizedAddition;
  }

  return `${currentDraft.trim()} ${normalizedAddition}`;
}

function createListeningSegment(
  text: string,
  source: ListeningSegmentSource,
): ListeningSegment {
  const normalizedText = normalizeTranscript(text);

  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `segment-${Date.now()}-${Math.round(performance.now())}`,
    text: normalizedText,
    source,
    createdAt: new Date().toISOString(),
    wordCount: normalizedText.split(/\s+/).filter(Boolean).length,
  };
}

function buildSessionEventId(sequence: number) {
  return `session-event-${sequence.toString().padStart(6, "0")}`;
}

function buildUtteranceKey(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(performance.now())}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampScore(value: unknown, fallback: number) {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : fallback;
}

function isSpeakerOption(value: unknown): value is TranscriptTurn["speaker"] {
  return speakerOptions.includes(value as TranscriptTurn["speaker"]);
}

function isListeningSegment(value: unknown): value is ListeningSegment {
  return (
    isObjectRecord(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    (value.source === "speech_final" || value.source === "stored_draft") &&
    typeof value.createdAt === "string" &&
    typeof value.wordCount === "number"
  );
}

function buildCommitScores(
  scoreMode: ListeningScoreMode,
  customScores: ListeningScoreDraft,
) {
  return scoreMode === "custom" ? customScores : sandboxDefaults;
}

function readStoredListeningDraft(
  engineSessionId: string,
): StoredListeningDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(
      listeningDraftStorageKey(engineSessionId),
    );

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);

    if (!isObjectRecord(parsed)) {
      return null;
    }

    const segments = Array.isArray(parsed.segments)
      ? parsed.segments.filter(isListeningSegment)
      : [];
    const storedCustomScores = isObjectRecord(parsed.customScores)
      ? parsed.customScores
      : {};

    return {
      speaker: isSpeakerOption(parsed.speaker) ? parsed.speaker : "guest",
      draftText: typeof parsed.draftText === "string" ? parsed.draftText : "",
      segments,
      commitMode:
        parsed.commitMode === "per_segment" ? "per_segment" : "single_turn",
      scoreMode: parsed.scoreMode === "custom" ? "custom" : "defaults",
      customScores: {
        energyScore: clampScore(
          storedCustomScores.energyScore,
          sandboxDefaults.energyScore,
        ),
        specificityScore: clampScore(
          storedCustomScores.specificityScore,
          sandboxDefaults.specificityScore,
        ),
        evasionScore: clampScore(
          storedCustomScores.evasionScore,
          sandboxDefaults.evasionScore,
        ),
        noveltyScore: clampScore(
          storedCustomScores.noveltyScore,
          sandboxDefaults.noveltyScore,
        ),
      },
    };
  } catch {
    return null;
  }
}

export function ReplayListeningSandbox({
  engineSessionId,
  replaySourceLabel,
  lastCommittedTurn,
  onCommitDrafts,
}: ReplayListeningSandboxProps) {
  const searchParams = useSearchParams();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const committedTranscriptRef = useRef("");
  const hydratedDraftRef = useRef(false);
  const startupRequestHandledRef = useRef<string | null>(null);
  const rawEventSequenceRef = useRef(0);
  const partialSnapshotByUtteranceRef = useRef(new Map<string, string>());
  const [isListening, setIsListening] = useState(false);
  const [activeUtteranceKey, setActiveUtteranceKey] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState<TranscriptTurn["speaker"]>("guest");
  const [draftText, setDraftText] = useState("");
  const [segments, setSegments] = useState<ListeningSegment[]>([]);
  const [rawEvents, setRawEvents] = useState<RawTranscriptEvent[]>([]);
  const [interimText, setInterimText] = useState("");
  const [commitMode, setCommitMode] =
    useState<ListeningCommitMode>("single_turn");
  const [scoreMode, setScoreMode] = useState<ListeningScoreMode>("defaults");
  const [customScores, setCustomScores] =
    useState<ListeningScoreDraft>(sandboxDefaults);
  const [availability, setAvailability] = useState<
    "unknown" | "available" | "unsupported" | "error"
  >("unknown");
  const [statusMessage, setStatusMessage] = useState(
    "Speech capture is sandbox-only. If browser recognition is weak or unavailable, type or paste into the draft box and commit manually.",
  );
  const [error, setError] = useState<string | null>(null);
  const [lastCommit, setLastCommit] = useState<ListeningLastCommit | null>(null);
  const [lastHeardText, setLastHeardText] = useState("");
  const [lastHeardAt, setLastHeardAt] = useState<string | null>(null);
  const [wasRestored, setWasRestored] = useState(false);
  const [segmentsExpanded, setSegmentsExpanded] = useState(false);
  const [ignoredEventCount, setIgnoredEventCount] = useState(0);

  const sessionState = error
    ? "Error"
    : isListening
      ? "Listening"
      : draftText.trim() || segments.length > 0 || interimText
        ? "Draft ready"
        : "Idle";
  const uncommittedWordCount = normalizeTranscript(`${draftText} ${interimText}`)
    .split(/\s+/)
    .filter(Boolean).length;
  const livePreview = useMemo(() => {
    const previewText = normalizeTranscript(`${draftText} ${interimText}`);

    if (!previewText) {
      return null;
    }

    const previewScores = buildCommitScores(scoreMode, customScores);
    const previewTurn: TranscriptTurn = {
      id: "00000000-0000-4000-8000-000000000000",
      sessionId: engineSessionId,
      timestamp: new Date().toISOString(),
      speaker,
      text: previewText,
      energyScore: previewScores.energyScore,
      specificityScore: previewScores.specificityScore,
      evasionScore: previewScores.evasionScore,
      noveltyScore: previewScores.noveltyScore,
      threadIdLink: null,
    };
    const analysis = analyzeReplayCommittedTurn(previewTurn, {
      previousTurn: lastCommittedTurn,
    });

    return {
      text: previewText,
      analysis,
      memory: extractReplayTurnMemory(previewTurn, analysis),
    };
  }, [
    customScores,
    draftText,
    engineSessionId,
    interimText,
    lastCommittedTurn,
    scoreMode,
    speaker,
  ]);
  const liveCueSignals = useMemo(
    () =>
      livePreview
        ? buildCueSignals(livePreview.analysis, livePreview.memory)
        : [],
    [livePreview],
  );
  const liveIdeaSignals = useMemo(
    () => (livePreview ? buildIdeaSignals(livePreview.memory) : []),
    [livePreview],
  );
  const sessionMemoryStore = useMemo(
    () =>
      buildSessionMemoryStore(engineSessionId, rawEvents, {
        ignoredEventCount,
      }),
    [engineSessionId, ignoredEventCount, rawEvents],
  );
  const lastHeardTimestampLabel = lastHeardAt
    ? new Date(lastHeardAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Nothing heard yet";
  const micMonitorLabel = isListening
    ? "Mic live"
    : availability === "available"
      ? "Ready to listen"
      : availability === "unsupported"
        ? "Mic unavailable"
        : availability === "error"
          ? "Mic error"
        : "Checking mic";

  function appendRawTranscriptEvent(
    eventType: RawTranscriptEvent["eventType"],
    source: SessionTranscriptEventSource,
    text: string,
    options: {
      utteranceKey?: string;
      confidence?: number | null;
      speakerOverride?: TranscriptTurn["speaker"] | null;
      speakerConfidence?: number | null;
      occurredAt?: string;
    } = {},
  ) {
    const normalizedText = normalizeTranscript(text);

    if (!normalizedText) {
      setIgnoredEventCount((currentCount) => currentCount + 1);
      return;
    }

    const utteranceKey =
      options.utteranceKey ??
      activeUtteranceKey ??
      `utterance-${rawEventSequenceRef.current + 1}`;

    if (eventType === "partial") {
      const lastSnapshot = partialSnapshotByUtteranceRef.current.get(utteranceKey);

      if (lastSnapshot === normalizedText) {
        setIgnoredEventCount((currentCount) => currentCount + 1);
        return;
      }

      if (
        lastSnapshot &&
        normalizedText.length < lastSnapshot.length &&
        lastSnapshot.includes(normalizedText)
      ) {
        setIgnoredEventCount((currentCount) => currentCount + 1);
        return;
      }

      partialSnapshotByUtteranceRef.current.set(utteranceKey, normalizedText);
    } else {
      partialSnapshotByUtteranceRef.current.delete(utteranceKey);
    }

    rawEventSequenceRef.current += 1;

    setRawEvents((currentEvents) => [
      ...currentEvents,
      {
        id: buildSessionEventId(rawEventSequenceRef.current),
        sessionId: engineSessionId,
        utteranceKey,
        source,
        eventType,
        sequence: rawEventSequenceRef.current,
        occurredAt: options.occurredAt ?? new Date().toISOString(),
        text: normalizedText,
        confidence: options.confidence ?? null,
        speaker: options.speakerOverride ?? speaker,
        speakerConfidence: options.speakerConfidence ?? 1,
      },
    ]);
  }

  useEffect(() => {
    committedTranscriptRef.current = draftText;
  }, [draftText]);

  useEffect(() => {
    const Recognition = getBrowserSpeechRecognitionConstructor();

    startTransition(() => {
      setAvailability(Recognition ? "available" : "unsupported");
    });
  }, []);

  useEffect(() => {
    try {
      const storedDraft = readStoredListeningDraft(engineSessionId);

      hydratedDraftRef.current = true;

      if (!storedDraft) {
        return;
      }

      committedTranscriptRef.current = storedDraft.draftText;
      rawEventSequenceRef.current = storedDraft.segments.length;
      partialSnapshotByUtteranceRef.current.clear();
      startTransition(() => {
        setSpeaker(storedDraft.speaker);
        setDraftText(storedDraft.draftText);
        setSegments(storedDraft.segments);
        setRawEvents(
          storedDraft.segments.map((segment, index) => ({
            id: buildSessionEventId(index + 1),
            sessionId: engineSessionId,
            utteranceKey: segment.id,
            source:
              segment.source === "speech_final"
                ? "sandbox_final"
                : "stored_draft",
            eventType: "final",
            sequence: index + 1,
            occurredAt: segment.createdAt,
            text: segment.text,
            confidence: segment.source === "speech_final" ? 0.75 : 1,
            speaker: storedDraft.speaker,
            speakerConfidence: 1,
          })),
        );
        setCommitMode(storedDraft.commitMode);
        setScoreMode(storedDraft.scoreMode);
        setCustomScores(storedDraft.customScores);
        setWasRestored(true);
        setStatusMessage(
          "Restored browser-local sandbox state. Review it before committing anything into replay.",
        );
      });
    } catch {
      hydratedDraftRef.current = true;
    }
  }, [engineSessionId]);

  useEffect(() => {
    if (!hydratedDraftRef.current) {
      return;
    }

    try {
      const hasPersistableState =
        draftText.trim().length > 0 ||
        segments.length > 0 ||
        scoreMode === "custom" ||
        commitMode === "per_segment";

      if (!hasPersistableState) {
        window.localStorage.removeItem(listeningDraftStorageKey(engineSessionId));
        return;
      }

      window.localStorage.setItem(
        listeningDraftStorageKey(engineSessionId),
        JSON.stringify({
          speaker,
          draftText: draftText.trim(),
          segments,
          commitMode,
          scoreMode,
          customScores,
        }),
      );
    } catch {
      // Browser-local draft persistence is best-effort only.
    }
  }, [
    commitMode,
    customScores,
    draftText,
    engineSessionId,
    scoreMode,
    segments,
    speaker,
  ]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
    };
  }, []);

  function clearRecognitionState() {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    partialSnapshotByUtteranceRef.current.clear();
    setActiveUtteranceKey(null);
    setIsListening(false);
    setInterimText("");
  }

  function handleStartListening() {
    clearRecognitionState();
    const Recognition = getBrowserSpeechRecognitionConstructor();

    if (!Recognition) {
      setAvailability("unsupported");
      setStatusMessage(
        "This browser does not expose speech recognition here. Use the editable draft box and segment tools instead.",
      );
      setError(
        "Browser speech recognition is unavailable here. Type or paste into the draft box instead.",
      );
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalChunk += `${transcript} `;
        } else {
          interimChunk += `${transcript} `;
        }
      }

      const normalizedFinalChunk = normalizeTranscript(finalChunk);
      const normalizedInterimChunk = normalizeTranscript(interimChunk);
      const heardAt = new Date().toISOString();

      if (normalizedFinalChunk) {
        const nextSegment = createListeningSegment(
          normalizedFinalChunk,
          "speech_final",
        );
        const utteranceKey =
          activeUtteranceKey ?? nextSegment.id;

        setSegments((currentSegments) => [...currentSegments, nextSegment]);
        appendRawTranscriptEvent("final", "sandbox_final", normalizedFinalChunk, {
          utteranceKey,
          confidence: 0.75,
          occurredAt: heardAt,
        });
        setActiveUtteranceKey(null);
        setDraftText((currentDraft) => {
          const nextDraft = appendToDraft(currentDraft, normalizedFinalChunk);
          committedTranscriptRef.current = nextDraft;
          return nextDraft;
        });
        setStatusMessage(
          "Captured a finalized speech segment and appended it into the editable draft.",
        );
        setLastHeardText(normalizedFinalChunk);
        setLastHeardAt(heardAt);
        setInterimText("");
      }

      if (normalizedInterimChunk) {
        const utteranceKey =
          activeUtteranceKey ??
          buildUtteranceKey("speech-live");

        setActiveUtteranceKey(utteranceKey);
        appendRawTranscriptEvent("partial", "sandbox_partial", normalizedInterimChunk, {
          utteranceKey,
          confidence: 0.55,
          occurredAt: heardAt,
        });
        setLastHeardText(normalizedInterimChunk);
        setLastHeardAt(heardAt);
      }

      setInterimText(normalizedInterimChunk);
      setError(null);
    };

    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setAvailability("error");
      setStatusMessage(
        "Speech recognition hit an error. The typed draft fallback and segment tools are still available below.",
      );
      setError(`Recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setStatusMessage(
        "Listening stopped. Review the draft or captured segments, then commit intentionally into replay.",
      );
    };

    recognitionRef.current = recognition;
    setAvailability("available");
    setError(null);
    setIsListening(true);
    setInterimText("");
    setStatusMessage(
      "Listening started. Interim speech may flicker. Finalized speech segments will append into the editable draft.",
    );
    try {
      recognition.start();
    } catch (startError) {
      recognitionRef.current = null;
      setAvailability("error");
      setIsListening(false);
      setStatusMessage(
        "Could not start browser speech recognition. Use the typed draft fallback or retry listening.",
      );
      setError(
        startError instanceof Error
          ? `Recognition start failed: ${startError.message}`
          : "Recognition start failed.",
      );
    }
  }

  function handleStopListening() {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    partialSnapshotByUtteranceRef.current.clear();
    setActiveUtteranceKey(null);
    setIsListening(false);
    setInterimText("");
    setStatusMessage(
      "Listening stopped. Draft and captured segments remain local until you clear or commit them.",
    );
  }

  function handleRestartListening() {
    setStatusMessage("Restarting speech recognition...");
    clearRecognitionState();
    window.setTimeout(() => {
      handleStartListening();
    }, 120);
  }

  function handleStoreDraftAsSegment() {
    const normalizedDraft = normalizeTranscript(draftText);

    if (!normalizedDraft) {
      setError("Enter or capture draft text before storing it as a segment.");
      return;
    }

    const nextSegment = createListeningSegment(normalizedDraft, "stored_draft");

    setSegments((currentSegments) => [
      ...currentSegments,
      nextSegment,
    ]);
    appendRawTranscriptEvent("final", "stored_draft", normalizedDraft, {
      utteranceKey: nextSegment.id,
      confidence: 1,
      occurredAt: nextSegment.createdAt,
    });
    setDraftText("");
    committedTranscriptRef.current = "";
    setInterimText("");
    setError(null);
    setStatusMessage(
      "Stored the current draft as a reusable segment. You can commit segments individually or rebuild the draft from them later.",
    );
  }

  function handleRebuildDraftFromSegments() {
    if (segments.length === 0) {
      setError("There are no captured segments to rebuild from.");
      return;
    }

    const nextDraft = buildDraftFromSegments(segments);

    setDraftText(nextDraft);
    committedTranscriptRef.current = nextDraft;
    setInterimText("");
    setError(null);
    setStatusMessage(
      "Rebuilt the editable draft from the current segment list.",
    );
  }

  function handleRemoveSegment(segmentId: string) {
    setSegments((currentSegments) =>
      currentSegments.filter((segment) => segment.id !== segmentId),
    );
    setRawEvents((currentEvents) =>
      currentEvents.filter((event) => event.utteranceKey !== segmentId),
    );
    setStatusMessage(
      "Removed one captured segment. Rebuild the draft from segments if you want the editable draft to match the current segment list.",
    );
  }

  function handleCommitDrafts() {
    const nextScores = buildCommitScores(scoreMode, customScores);
    let draftsToCommit: ReplayTranscriptTurnDraft[] = [];

    if (commitMode === "single_turn") {
      const normalizedDraft = normalizeTranscript(`${draftText} ${interimText}`);

      if (!normalizedDraft) {
        setError("Capture or enter transcript text before committing it to replay.");
        return;
      }

      draftsToCommit = [
        {
          source: "listening_sandbox_draft",
          speaker,
          text: normalizedDraft,
          ...nextScores,
        },
      ];
    } else {
      if (segments.length === 0) {
        setError(
          "Capture or store at least one segment before committing one turn per segment.",
        );
        return;
      }

      draftsToCommit = segments.map((segment) => ({
        source: "listening_sandbox_segment",
        speaker,
        text: segment.text,
        ...nextScores,
      }));
    }

    try {
      if (commitMode === "single_turn") {
        appendRawTranscriptEvent("final", "stored_draft", draftsToCommit[0]!.text, {
          utteranceKey: activeUtteranceKey ?? `commit-${Date.now()}`,
          confidence: 1,
        });
        setActiveUtteranceKey(null);
      }

      onCommitDrafts(draftsToCommit);
      const wordCount = draftsToCommit.reduce(
        (total, draft) =>
          total + draft.text.split(/\s+/).filter(Boolean).length,
        0,
      );

      setLastCommit({
        committedAt: new Date().toISOString(),
        speaker,
        mode: commitMode,
        turnCount: draftsToCommit.length,
        wordCount,
      });
      setDraftText("");
      setSegments([]);
      setInterimText("");
      committedTranscriptRef.current = "";
      setError(null);
      setWasRestored(false);
      setStatusMessage(
        commitMode === "single_turn"
          ? `Committed one replay-local turn as ${speaker}.`
          : `Committed ${draftsToCommit.length} replay-local turns from captured segments as ${speaker}.`,
      );
      window.localStorage.removeItem(listeningDraftStorageKey(engineSessionId));
    } catch {
      setError("Commit into replay failed. Draft and segments are still here locally.");
    }
  }

  function handleClearDraft() {
    setDraftText("");
    committedTranscriptRef.current = "";
    setInterimText("");
    setError(null);
    setStatusMessage("Cleared the editable draft.");
    try {
      window.localStorage.removeItem(listeningDraftStorageKey(engineSessionId));
    } catch {
      // Browser-local draft persistence is best-effort only.
    }
  }

  function handleClearSegments() {
    const currentSegmentIds = new Set(segments.map((segment) => segment.id));

    setSegments([]);
    setRawEvents((currentEvents) =>
      currentEvents.filter((event) => !currentSegmentIds.has(event.utteranceKey)),
    );
    setError(null);
    setStatusMessage("Cleared all captured segments.");
  }

  function handleClearSession() {
    clearRecognitionState();
    setSpeaker("guest");
    setDraftText("");
    setSegments([]);
    setCommitMode("single_turn");
    setScoreMode("defaults");
    setCustomScores(sandboxDefaults);
    setError(null);
    setLastCommit(null);
    setLastHeardText("");
    setLastHeardAt(null);
    setWasRestored(false);
    setRawEvents([]);
    setIgnoredEventCount(0);
    rawEventSequenceRef.current = 0;
    partialSnapshotByUtteranceRef.current.clear();
    setActiveUtteranceKey(null);
    setStatusMessage("Cleared the entire sandbox session.");
    try {
      window.localStorage.removeItem(listeningDraftStorageKey(engineSessionId));
    } catch {
      // Browser-local sandbox persistence is best-effort only.
    }
  }

  const runNewInterviewStartup = useEffectEvent(
    (shouldAutostartListening: boolean) => {
      handleClearSession();
      setStatusMessage(
        shouldAutostartListening
          ? "Opened a new interview workspace. Listening will start automatically if browser recognition is available here."
          : "Opened a new interview workspace. The sandbox is cleared and ready for a fresh capture.",
      );

      if (shouldAutostartListening) {
        window.setTimeout(() => {
          handleStartListening();
        }, 180);
      }
    },
  );

  useEffect(() => {
    const isNewInterview = searchParams.get("newInterview") === "1";
    const shouldAutostartListening =
      searchParams.get("autostartListening") === "1";
    const startupKey = `${engineSessionId}:${isNewInterview}:${shouldAutostartListening}`;

    if (
      (!isNewInterview && !shouldAutostartListening) ||
      startupRequestHandledRef.current === startupKey
    ) {
      return;
    }

    startupRequestHandledRef.current = startupKey;
    const nextUrl = `${window.location.pathname}${window.location.hash || "#listening-sandbox"}`;
    window.history.replaceState({}, "", nextUrl);

    const timerId = window.setTimeout(() => {
      runNewInterviewStartup(shouldAutostartListening);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [engineSessionId, searchParams]);

  function updateCustomScore(
    key: keyof ListeningScoreDraft,
    value: string,
  ) {
    const nextValue = Number.parseFloat(value);

    setCustomScores((currentScores) => ({
      ...currentScores,
      [key]:
        Number.isFinite(nextValue) && nextValue >= 0 && nextValue <= 1
          ? nextValue
          : 0,
    }));
  }

  return (
    <section id="listening-sandbox" className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Listening sandbox</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            Experimental transcript harness
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            Debug-only laptop capture. This is not production live mode and it
            does not claim reliable speech recognition. Nothing changes replay
            until you commit intentionally into the current replay-local stream.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Current replay source
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {replaySourceLabel}
          </p>
        </div>
      </div>

      {wasRestored ? (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Restored browser-local sandbox state on this machine. Review it
          before committing anything into replay.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Session state
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {sessionState}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Mic monitor
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {micMonitorLabel}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            {availability === "available"
              ? "Browser recognition is available in this tab."
              : availability === "unsupported"
                ? "This browser cannot expose speech recognition here."
                : availability === "error"
                  ? "Recognition is in an error state. Retry or type instead."
                  : "Checking browser speech support."}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Latest heard
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-stone-900">
            {lastHeardText || "Waiting for speech or typed input."}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            {lastHeardTimestampLabel}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Uncommitted words
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {uncommittedWordCount}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Captured segments
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {segments.length}
          </p>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
          What is happening
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {statusMessage}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-white/85 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Brain now
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-700">
              This updates while you speak or type so you can see what was heard and how it is being organized before commit.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
              isListening
                ? "bg-emerald-100 text-emerald-950"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {isListening
              ? "Listening live"
              : livePreview
                ? "Preview active"
                : "Waiting for input"}
          </span>
        </div>

        {livePreview ? (
          <>
            <p className="mt-4 text-sm leading-6 text-stone-800">
              {livePreview.text}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-600">
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Emotion {livePreview.analysis.affective.dominantEmotion.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Affect {livePreview.analysis.affective.intensity}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Valence {livePreview.analysis.affective.valence}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Completion {livePreview.analysis.completion.completionStatus.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Thread {livePreview.analysis.threadAction.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Cue {livePreview.analysis.cuePotential}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                Salience {livePreview.memory.salience}
              </span>
              {livePreview.analysis.interruption.interruptedPreviousTurn ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                  Interrupted previous turn
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                  Pressure / cue signals
                </p>
                {liveCueSignals.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {liveCueSignals.map((signal) => (
                      <span
                        key={signal.label}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getSignalChipClassName(signal.tone)}`}
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-stone-800">
                    No cue-worthy pressure yet. Keep speaking or type more detail.
                  </p>
                )}
              </article>
              <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                  Organized ideas
                </p>
                {livePreview.memory.claims[0] ? (
                  <p className="mt-2 text-sm leading-6 text-stone-800">
                    {livePreview.memory.claims[0]}
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-stone-800">
                    No stable claim yet.
                  </p>
                )}
                {liveIdeaSignals.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {liveIdeaSignals.map((signal) => (
                      <span
                        key={signal.label}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getSignalChipClassName(signal.tone)}`}
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {livePreview.analysis.affective.triggerTerms.filter(
                  (term) => term.tier !== "intensifier",
                ).length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-stone-600">
                    Trigger words:{" "}
                    {livePreview.analysis.affective.triggerTerms
                      .filter((term) => term.tier !== "intensifier")
                      .slice(0, 4)
                      .map((term) => term.term)
                      .join(", ")}
                  </p>
                ) : null}
              </article>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm leading-6 text-stone-600">
            Start listening or type in the draft box to see the brain organize what it hears before you commit anything.
          </p>
        )}
      </div>

      <div className="mt-5">
        <SessionMemoryDebugPanel store={sessionMemoryStore} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleStartListening}
          disabled={isListening}
          className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start listening
        </button>
        <button
          type="button"
          onClick={handleStopListening}
          disabled={!isListening}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Stop listening
        </button>
        <button
          type="button"
          onClick={handleCommitDrafts}
          className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 transition hover:border-emerald-400"
        >
          Commit to replay
        </button>
        <button
          type="button"
          onClick={handleClearSession}
          className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400"
        >
          Clear session
        </button>
      </div>

      <div className="mt-6 space-y-5">
        <label className="block rounded-3xl border border-stone-200 bg-white/80 p-4">
          <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Editable draft transcript
          </span>
          <textarea
            value={draftText}
            onChange={(event) => {
              setDraftText(event.target.value);
              setError(null);
            }}
            rows={8}
            placeholder="Speech drafts accumulate here. You can also type or paste here directly if browser capture is weak."
            className="mt-3 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
          />
          <p className="mt-3 text-sm leading-6 text-stone-600">
            The editable draft is still uncommitted. It only affects replay
            after an explicit commit.
          </p>
        </label>

        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Interim capture
            </p>
            <button
              type="button"
              onClick={handleStoreDraftAsSegment}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400"
            >
              Store draft as segment
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {interimText || "No interim text right now."}
          </p>
        </div>

        <details className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-stone-500">
            Advanced commit controls
          </summary>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Commit speaker
              </span>
              <select
                value={speaker}
                onChange={(event) =>
                  setSpeaker(event.target.value as TranscriptTurn["speaker"])
                }
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              >
                {speakerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Commit mode
              </span>
              <select
                value={commitMode}
                onChange={(event) =>
                  setCommitMode(event.target.value as ListeningCommitMode)
                }
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              >
                <option value="single_turn">Editable draft as one turn</option>
                <option value="per_segment">One replay turn per segment</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Score mode
              </span>
              <select
                value={scoreMode}
                onChange={(event) =>
                  setScoreMode(event.target.value as ListeningScoreMode)
                }
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              >
                <option value="defaults">Deterministic sandbox defaults</option>
                <option value="custom">Custom operator scores</option>
              </select>
            </label>
            <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Commit behavior
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {commitMode === "single_turn"
                  ? "Commits the editable draft as one replay-local turn."
                  : "Commits each captured segment as its own replay-local turn. The editable draft is ignored in this mode."}
              </p>
            </article>
          </div>

          {scoreMode === "custom" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  Energy
                </span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customScores.energyScore}
                  onChange={(event) =>
                    updateCustomScore("energyScore", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  Specificity
                </span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customScores.specificityScore}
                  onChange={(event) =>
                    updateCustomScore("specificityScore", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  Evasion
                </span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customScores.evasionScore}
                  onChange={(event) =>
                    updateCustomScore("evasionScore", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  Novelty
                </span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customScores.noveltyScore}
                  onChange={(event) =>
                    updateCustomScore("noveltyScore", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
                />
              </label>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-stone-700">
              Using deterministic sandbox defaults: energy{" "}
              {sandboxDefaults.energyScore}, specificity{" "}
              {sandboxDefaults.specificityScore}, evasion{" "}
              {sandboxDefaults.evasionScore}, novelty{" "}
              {sandboxDefaults.noveltyScore}.
            </p>
          )}

          {lastCommit ? (
            <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">
                Last replay commit
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">
                {lastCommit.turnCount} turn
                {lastCommit.turnCount === 1 ? "" : "s"} committed as{" "}
                {lastCommit.speaker} via {lastCommit.mode.replaceAll("_", " ")}{" "}
                at {lastCommit.committedAt}. Total words: {lastCommit.wordCount}.
              </p>
            </div>
          ) : null}
        </details>

        <details className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-stone-500">
            Captured segments and raw staging
          </summary>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSegmentsExpanded((value) => !value)}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
            >
              {segments.length} segment{segments.length === 1 ? "" : "s"} captured -{" "}
              {segmentsExpanded ? "hide" : "show"}
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRebuildDraftFromSegments}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400"
              >
                Rebuild draft
              </button>
              <button
                type="button"
                onClick={handleRestartListening}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400"
              >
                Restart listening
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400"
              >
                Clear draft
              </button>
              <button
                type="button"
                onClick={handleClearSegments}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400"
              >
                Clear segments
              </button>
            </div>
          </div>

          {segmentsExpanded ? (
            <div className="mt-4 space-y-3">
              {segments.length > 0 ? (
                segments.map((segment, index) => (
                  <article
                    key={segment.id}
                    className="rounded-2xl border border-stone-200 bg-white/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-stone-500">
                        <span>Segment {index + 1}</span>
                        <span>
                          {segment.source === "speech_final"
                            ? "Speech"
                            : "Stored draft"}
                        </span>
                        <span>{segment.createdAt}</span>
                        <span>{segment.wordCount} words</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSegment(segment.id)}
                        className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400"
                      >
                        Discard
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-800">
                      {segment.text}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-stone-600">
                  No captured segments yet. Browser speech finalization or
                  storing the current draft will populate this list.
                </p>
              )}
            </div>
          ) : null}
        </details>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : null}
    </section>
  );
}
