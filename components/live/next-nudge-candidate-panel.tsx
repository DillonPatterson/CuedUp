"use client";

import type { TranscriptNextNudgeSelection } from "@/lib/transcript/organization/types";

type NextNudgeCandidatePanelProps = {
  selection: TranscriptNextNudgeSelection;
  title?: string;
  showBackups?: boolean;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function NextNudgeCandidatePanel({
  selection,
  title = "Best next nudge",
  showBackups = true,
}: NextNudgeCandidatePanelProps) {
  const bestCandidate = selection.bestCandidate;

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{title}</p>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-700">
          {bestCandidate ? formatLabel(bestCandidate.promptAngle) : "No candidate"}
        </span>
      </div>

      {bestCandidate ? (
        <article className="mt-4 rounded-3xl border border-stone-200 bg-stone-50/70 p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-500">
            <span>{formatLabel(bestCandidate.sourceKind)}</span>
            <span>{formatLabel(bestCandidate.readiness)}</span>
            {bestCandidate.debtScore > 0 ? <span>Debt {bestCandidate.debtScore}</span> : null}
            {bestCandidate.affectiveWeight !== "low" ? (
              <span>Affect {bestCandidate.affectiveWeight}</span>
            ) : null}
            {bestCandidate.interrupted ? <span>Interrupted</span> : null}
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-stone-900">
            {bestCandidate.label}
          </h3>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            {bestCandidate.reason}
          </p>
        </article>
      ) : (
        <p className="mt-4 text-sm leading-6 text-stone-600">
          No next nudge candidate is available yet.
        </p>
      )}

      {showBackups && selection.backupCandidates.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Backup options
          </p>
          {selection.backupCandidates.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-2xl border border-stone-200 bg-white/80 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-stone-900">
                  {candidate.label}
                </p>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-700">
                  {formatLabel(candidate.promptAngle)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-600">
                {candidate.reason}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
