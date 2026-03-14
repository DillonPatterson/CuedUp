"use client";

import { useState } from "react";
import type { TranscriptTurn } from "@/types";
import type { ManualTranscriptTurnDraft } from "@/lib/transcript/manual-turns";

type ReplayTranscriptInputProps = {
  onAppend: (draft: ManualTranscriptTurnDraft) => void;
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
  onAppend,
}: ReplayTranscriptInputProps) {
  const [draft, setDraft] = useState(initialDraft);

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

  return (
    <section className="panel p-6">
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
    </section>
  );
}
