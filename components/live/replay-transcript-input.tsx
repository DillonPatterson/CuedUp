"use client";

import { useState } from "react";
import type { TranscriptTurn } from "@/types";
import type { ManualTranscriptTurnDraft } from "@/lib/transcript/manual-turns";
import type { ReplayFixtureDefinition } from "@/lib/mock/replay-fixtures";

type ReplayTranscriptInputProps = {
  fixtures: ReplayFixtureDefinition[];
  activeFixtureId: string | null;
  replaySourceLabel: string;
  replaySourceDetail: string;
  onAppend: (draft: ManualTranscriptTurnDraft) => void;
  onImport: (rawTranscript: string) => void;
  onLoadFixture: (fixtureId: string) => void;
  onResetToSeededSession: () => void;
};

const initialDraft: ManualTranscriptTurnDraft = {
  speaker: "host",
  text: "",
  energyScore: 0.5,
  specificityScore: 0.6,
  evasionScore: 0.1,
  noveltyScore: 0.5,
  threadIdLink: null,
};

const speakerOptions: TranscriptTurn["speaker"][] = [
  "host",
  "guest",
  "producer",
  "system",
];

export function ReplayTranscriptInput({
  fixtures,
  activeFixtureId,
  replaySourceLabel,
  replaySourceDetail,
  onAppend,
  onImport,
  onLoadFixture,
  onResetToSeededSession,
}: ReplayTranscriptInputProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [rawTranscript, setRawTranscript] = useState("");
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function clearAllErrors() {
    setFixtureError(null);
    setManualError(null);
    setImportError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.text.trim()) {
      setManualError("Enter transcript text before appending a turn.");
      return;
    }

    try {
      onAppend({
        ...draft,
        text: draft.text.trim(),
      });
      clearAllErrors();
      setDraft((currentDraft) => ({
        ...currentDraft,
        text: "",
      }));
    } catch (error) {
      setManualError(
        error instanceof Error ? error.message : "Unable to append manual turn.",
      );
    }
  }

  function updateScore(
    key: "energyScore" | "specificityScore" | "evasionScore" | "noveltyScore",
    value: string,
  ) {
    const nextValue = Number.parseFloat(value);

    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: Number.isFinite(nextValue) ? nextValue : 0,
    }));
  }

  function handleImportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      onImport(rawTranscript);
      clearAllErrors();
      setRawTranscript("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to load transcript.",
      );
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      onImport(await file.text());
      clearAllErrors();
      setRawTranscript("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to load transcript.",
      );
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section id="replay-input" className="panel p-6">
      <div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Current replay source
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {replaySourceLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {replaySourceDetail}
          </p>
        </div>

        <p className="eyebrow">Replay fixtures</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-900">
          Fixture loader
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Replaces the current replay-local turn stream with a built-in fixture,
          stops autoplay, and jumps to the latest loaded snapshot.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {fixtures.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              onClick={() => {
                try {
                  onLoadFixture(fixture.id);
                  clearAllErrors();
                } catch (error) {
                  setFixtureError(
                    error instanceof Error
                      ? error.message
                      : "Unable to load fixture transcript.",
                  );
                }
              }}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                activeFixtureId === fixture.id
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-stone-300 text-stone-700 hover:border-stone-400"
              }`}
            >
              {fixture.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onResetToSeededSession();
              clearAllErrors();
            }}
            className="rounded-full border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 transition hover:border-amber-400"
          >
            Reset to seeded mock session
          </button>
        </div>
        {fixtureError ? (
          <p className="mt-4 text-sm text-rose-700">{fixtureError}</p>
        ) : null}
      </div>

      <div className="mt-8 border-t border-stone-200 pt-8">
        <p className="eyebrow">Append turn</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-900">
          Manual transcript input
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Appends one turn onto the current replay-local stream. If a fixture is
          active, that fixture run becomes a modified exploratory run instead of
          a clean proof baseline.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              Speaker
            </span>
            <select
              value={draft.speaker}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  speaker: event.target.value as TranscriptTurn["speaker"],
                }))
              }
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
            >
              {speakerOptions.map((speaker) => (
                <option key={speaker} value={speaker}>
                  {speaker}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              Text
            </span>
            <textarea
              value={draft.text}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  text: event.target.value,
                }))
              }
              rows={5}
              className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Energy
              </span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.energyScore}
                onChange={(event) => updateScore("energyScore", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Specificity
              </span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.specificityScore}
                onChange={(event) => updateScore("specificityScore", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Evasion
              </span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.evasionScore}
                onChange={(event) => updateScore("evasionScore", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Novelty
              </span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.noveltyScore}
                onChange={(event) => updateScore("noveltyScore", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
              />
            </label>
          </div>

          {manualError ? (
            <p className="text-sm text-rose-700">{manualError}</p>
          ) : null}

          <button
            type="submit"
            className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
          >
            Append turn
          </button>
        </form>
      </div>

      <form
        className="mt-8 space-y-4 border-t border-stone-200 pt-8"
        onSubmit={handleImportSubmit}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            JSON transcript import
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Appends a JSON transcript onto the current replay-local stream. Use
            fixture load or seeded reset if you want replacement instead.
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Paste JSON
          </span>
          <textarea
            value={rawTranscript}
            onChange={(event) => setRawTranscript(event.target.value)}
            rows={6}
            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Or upload file
          </span>
          <input
            type="file"
            accept=".json,application/json,text/json"
            onChange={handleFileChange}
            className="mt-2 block w-full text-sm text-stone-700"
          />
        </label>

        {importError ? (
          <p className="text-sm text-rose-700">{importError}</p>
        ) : null}

        <button
          type="submit"
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
        >
          Load transcript
        </button>
      </form>
    </section>
  );
}
