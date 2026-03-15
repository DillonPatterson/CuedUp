"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { TranscriptTurn } from "@/types";
import type { ReplayTranscriptTurnDraft } from "@/lib/transcript/manual-turns";
import {
  type BrowserSpeechRecognition,
  getBrowserSpeechRecognitionConstructor,
} from "@/lib/listening/browser-speech";

type ReplayListeningSandboxProps = {
  engineSessionId: string;
  replaySourceLabel: string;
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

function normalizeTranscript(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
  onCommitDrafts,
}: ReplayListeningSandboxProps) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const committedTranscriptRef = useRef("");
  const hydratedDraftRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [speaker, setSpeaker] = useState<TranscriptTurn["speaker"]>("guest");
  const [draftText, setDraftText] = useState("");
  const [segments, setSegments] = useState<ListeningSegment[]>([]);
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
  const [wasRestored, setWasRestored] = useState(false);

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
      startTransition(() => {
        setSpeaker(storedDraft.speaker);
        setDraftText(storedDraft.draftText);
        setSegments(storedDraft.segments);
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

      if (normalizedFinalChunk) {
        const nextSegment = createListeningSegment(
          normalizedFinalChunk,
          "speech_final",
        );
        setSegments((currentSegments) => [...currentSegments, nextSegment]);
        setDraftText((currentDraft) => {
          const nextDraft = appendToDraft(currentDraft, normalizedFinalChunk);
          committedTranscriptRef.current = nextDraft;
          return nextDraft;
        });
        setStatusMessage(
          "Captured a finalized speech segment and appended it into the editable draft.",
        );
      }

      setInterimText(normalizeTranscript(interimChunk));
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
    recognition.start();
  }

  function handleStopListening() {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
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

    setSegments((currentSegments) => [
      ...currentSegments,
      createListeningSegment(normalizedDraft, "stored_draft"),
    ]);
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
    setSegments([]);
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
    setWasRestored(false);
    setStatusMessage("Cleared the entire sandbox session.");
    try {
      window.localStorage.removeItem(listeningDraftStorageKey(engineSessionId));
    } catch {
      // Browser-local sandbox persistence is best-effort only.
    }
  }

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

      <div className="mt-5 grid gap-3 md:grid-cols-4">
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
            Browser support
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {availability === "unknown"
              ? "Checking"
              : availability === "available"
                ? "Available here"
                : availability === "unsupported"
                  ? "Unavailable here"
                  : "Error state"}
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
          Sandbox status
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {statusMessage}
        </p>
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
          onClick={handleRestartListening}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
        >
          Restart listening
        </button>
        <button
          type="button"
          onClick={handleClearDraft}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
        >
          Clear draft
        </button>
        <button
          type="button"
          onClick={handleClearSegments}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
        >
          Clear segments
        </button>
        <button
          type="button"
          onClick={handleClearSession}
          className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-900 transition hover:border-rose-400"
        >
          Clear session
        </button>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
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

          <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
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

          <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                Commit mapping
              </p>
              <button
                type="button"
                onClick={handleCommitDrafts}
                className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 transition hover:border-emerald-400"
              >
                Commit to replay
              </button>
            </div>

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
          </div>
        </div>

        <div>
          <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  Captured segments
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  Final speech chunks and manually stored draft chunks. Removing
                  a segment does not rewrite the editable draft automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRebuildDraftFromSegments}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400"
              >
                Rebuild draft from segments
              </button>
            </div>

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
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : null}
    </section>
  );
}
