"use client";

import { useState } from "react";
import type { DossierSourceItem, SourceInputMode } from "@/lib/dossier/contracts";

type SourceUploadProps = {
  guestId: string;
  guestSlug: string;
  initialSources: DossierSourceItem[];
  promptPreview: string;
};

const sourceModes: { id: SourceInputMode; label: string }[] = [
  { id: "pasted_text", label: "Pasted text" },
  { id: "url", label: "URL list" },
  { id: "notes", label: "Notes" },
  { id: "transcript_excerpt", label: "Transcript excerpt" },
];

export function SourceUpload({
  guestId,
  guestSlug,
  initialSources,
  promptPreview,
}: SourceUploadProps) {
  const [activeMode, setActiveMode] = useState<SourceInputMode>("pasted_text");
  const [pastedText, setPastedText] = useState("");
  const [urlList, setUrlList] = useState("");
  const [notes, setNotes] = useState("");
  const [transcriptExcerpt, setTranscriptExcerpt] = useState("");

  return (
    <aside className="space-y-6">
      <section className="panel p-6">
        <p className="eyebrow">Source intake</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-900">
          Source inputs for {guestSlug}
        </h2>
        <p className="mt-3 text-stone-700">
          Local-only development shell for assembling prep material before the
          dossier pipeline runs. No upload backend is wired yet.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700">
            Guest ID: {guestId}
          </span>
          <span className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700">
            {initialSources.length} seed sources
          </span>
        </div>
      </section>

      <section className="panel p-6">
        <div className="flex flex-wrap gap-2">
          {sourceModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveMode(mode.id)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                activeMode === mode.id
                  ? "bg-amber-700 text-white"
                  : "border border-stone-200 bg-white text-stone-700"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {activeMode === "pasted_text" ? (
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">
                Paste article text or notes
              </span>
              <textarea
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none ring-0"
                placeholder="Paste source text here..."
              />
            </label>
          ) : null}

          {activeMode === "url" ? (
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">
                One URL per line
              </span>
              <textarea
                value={urlList}
                onChange={(event) => setUrlList(event.target.value)}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none ring-0"
                placeholder="https://example.com/article"
              />
            </label>
          ) : null}

          {activeMode === "notes" ? (
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">
                Producer notes
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none ring-0"
                placeholder="Add prep notes, suspected themes, emotional signals, and loose questions..."
              />
            </label>
          ) : null}

          {activeMode === "transcript_excerpt" ? (
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">
                Transcript excerpt
              </span>
              <textarea
                value={transcriptExcerpt}
                onChange={(event) => setTranscriptExcerpt(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none ring-0"
                placeholder="Paste a relevant excerpt from a prior interview..."
              />
            </label>
          ) : null}
        </div>
      </section>

      <section className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Seed sources
        </p>
        <div className="mt-4 space-y-3">
          {initialSources.map((source) => (
            <article
              key={source.id}
              className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-stone-900">
                  {source.title}
                </h3>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-600">
                  {source.mode.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {source.content}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Prompt preview
        </p>
        <pre className="mt-4 max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-xs leading-6 text-stone-700">
          {promptPreview}
        </pre>
      </section>
    </aside>
  );
}
