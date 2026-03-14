"use client";

import { useState } from "react";
import type { TranscriptTurn } from "@/types";
import type { ManualTranscriptTurnDraft } from "@/lib/transcript/manual-turns";
import type { ReplayFixtureDefinition } from "@/lib/mock/replay-fixtures";

type ReplayTranscriptInputProps = {
  fixtures: ReplayFixtureDefinition[];
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
  onAppend,
  onImport,
  onLoadFixture,
  onResetToSeededSession,
}: ReplayTranscriptInputProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [rawTranscript, setRawTranscript] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.text.trim()) {
      return;
    }

    onAppend({
      ...draft,
      text: draft.text.trim(),
    });
    setDraft((currentDraft) => ({
      ...currentDraft,
      text: "",
    }));
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
      setLoadError(null);
      setRawTranscript("");
    } catch (error) {
      setLoadError(
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
      setLoadError(null);
      setRawTranscript("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load transcript.",
      );
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section className="panel p-6">
      <div>
        <p className="eyebrow">Replay fixtures</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-900">
          Fixture loader
        </h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {fixtures.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              onClick={() => {
                try {
                  onLoadFixture(fixture.id);
                  setLoadError(null);
                } catch (error) {
                  setLoadError(
                    error instanceof Error
                      ? error.message
                      : "Unable to load fixture transcript.",
                  );
                }
              }}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
            >
              {fixture.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onResetToSeededSession();
              setLoadError(null);
            }}
            className="rounded-full border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 transition hover:border-amber-400"
          >
            Reset to seeded mock session
          </button>
        </div>
      </div>

      <div className="mt-8 border-t border-stone-200 pt-8">
      <p className="eyebrow">Append turn</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Manual transcript input
      </h2>

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

        <button
          type="submit"
          className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
        >
          Append turn
        </button>
      </form>
      </div>

      <form className="mt-8 space-y-4 border-t border-stone-200 pt-8" onSubmit={handleImportSubmit}>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Load transcript
          </p>
          <p className="mt-2 text-sm text-stone-600">
            JSON array of transcript-turn-like objects.
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

        {loadError ? (
          <p className="text-sm text-rose-700">{loadError}</p>
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
