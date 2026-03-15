"use client";

import { useMemo, useState } from "react";
import type { ReplayProofSummary as ReplayProofSummaryData } from "@/lib/replay/proof-session";

type ReplayProofSummaryProps = {
  summary: ReplayProofSummaryData;
  compactSummary: string;
  markdownSummary: string;
  jsonSummary: string;
};

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function downloadTextFile(filename: string, value: string, mimeType: string) {
  const blob = new Blob([value], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ReplayProofSummary({
  summary,
  compactSummary,
  markdownSummary,
  jsonSummary,
}: ReplayProofSummaryProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const pendingFixtures = useMemo(
    () =>
      summary.fixtures.filter(
        (fixture) =>
          fixture.reviewStatus !== "completed_all_observed" &&
          fixture.reviewStatus !== "completed_with_failures",
      ),
    [summary.fixtures],
  );

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(`${label} copy failed. Use the export block below.`);
    }
  }

  return (
    <section id="proof-summary" className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Proof session</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-900">
            Human proof summary
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Browser-local proof state only. This records the current human proof
            pass on this machine, not an automated verdict.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyText("Compact summary", compactSummary)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Copy compact
          </button>
          <button
            type="button"
            onClick={() => copyText("Markdown summary", markdownSummary)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Copy markdown
          </button>
          <button
            type="button"
            onClick={() => copyText("JSON summary", jsonSummary)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                "cuedup-proof-summary.md",
                markdownSummary,
                "text/markdown;charset=utf-8",
              )
            }
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Download markdown
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                "cuedup-proof-summary.json",
                jsonSummary,
                "application/json;charset=utf-8",
              )
            }
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Download JSON
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Overall status
          </p>
          <p className="mt-2 text-xl font-semibold text-stone-900">
            {formatStatus(summary.overallStatus)}
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Updated {summary.lastUpdatedAt ?? "never"}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Active fixture
          </p>
          <p className="mt-2 text-xl font-semibold text-stone-900">
            {summary.activeFixtureId ?? "none"}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Completed fixtures
          </p>
          <p className="mt-2 text-xl font-semibold text-stone-900">
            {summary.completedFixtureCount} / {summary.fixtures.length}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Failed reviews
          </p>
          <p className="mt-2 text-xl font-semibold text-rose-900">
            {summary.failedFixtureCount}
          </p>
        </article>
      </div>

      <div className="mt-5 rounded-3xl border border-stone-200 bg-stone-50/70 p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
          Remaining review work
        </p>
        {pendingFixtures.length > 0 ? (
          <div className="mt-3 space-y-3">
            {pendingFixtures.map((fixture) => (
              <article
                key={fixture.fixtureId}
                className="rounded-2xl border border-stone-200 bg-white/80 p-4"
              >
                <p className="text-lg font-semibold text-stone-900">
                  {fixture.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {formatStatus(fixture.reviewStatus)} | observed{" "}
                  {fixture.observedCount} | failed {fixture.failedCount} |
                  pending {fixture.pendingCount}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-stone-700">
            Every fixture has been reviewed. If anything still looks wrong, the
            issue is in the proof outcome, not missing proof work.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {summary.fixtures.map((fixture) => (
          <article
            key={fixture.fixtureId}
            className="rounded-2xl border border-stone-200 bg-white/80 p-4"
          >
            <p className="text-lg font-semibold text-stone-900">
              {fixture.label}
            </p>
            <p className="mt-2 text-sm text-stone-700">
              {formatStatus(fixture.reviewStatus)}
            </p>
            <p className="mt-2 text-sm text-stone-700">
              Assessment: {formatStatus(fixture.assessment)}
            </p>
            <p className="mt-2 text-sm text-stone-700">
              Updated {fixture.lastUpdatedAt ?? "never"}
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              Observed {fixture.observedCount} | Failed {fixture.failedCount} |
              Pending {fixture.pendingCount}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
            Compact copy block
          </p>
          <textarea
            readOnly
            value={compactSummary}
            rows={10}
            className="mt-3 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-mono text-sm text-stone-900"
          />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
            Markdown export block
          </p>
          <textarea
            readOnly
            value={markdownSummary}
            rows={18}
            className="mt-3 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-mono text-sm text-stone-900"
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-stone-600">
        {copyMessage ??
          "Use the compact block for notes or commit logs. Use markdown or JSON for deeper proof capture."}
      </p>
    </section>
  );
}
