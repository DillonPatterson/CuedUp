"use client";

import { useMemo } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { NextNudgeCandidatePanel } from "@/components/live/next-nudge-candidate-panel";
import { buildReplayTranscriptOrganization } from "@/lib/transcript/organization/build-session-organization";

type InterviewLiveProps = {
  engineSessionId: string;
  handoff: DossierLiveHandoff;
  transcriptTurns: TranscriptTurn[];
};

export function InterviewLive({
  engineSessionId,
  handoff,
  transcriptTurns,
}: InterviewLiveProps) {
  void engineSessionId;
  const currentTurn = transcriptTurns.at(-1) ?? null;
  const transcriptOrganization = useMemo(
    () => buildReplayTranscriptOrganization(transcriptTurns, {}, { handoff }),
    [handoff, transcriptTurns],
  );

  return (
    <section className="panel min-h-[32rem] px-6 py-8 md:px-10 md:py-10">
      <div className="mx-auto flex min-h-[24rem] max-w-3xl flex-col justify-between gap-8 rounded-[2rem] border border-stone-200 bg-stone-50/80 p-6 md:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-stone-50">
              Live
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-stone-600">
              Not connected
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-stone-600">
              Mock transcript
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
              Live interview stays sparse.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-stone-600">
              Rich conversation memory and recall analysis remain replay-only so
              live mode does not run the full debug organization path.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Session state
            </p>
            <dl className="mt-3 space-y-3 text-sm text-stone-700">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">Committed turns</dt>
                <dd className="font-medium text-stone-900">{transcriptTurns.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">Latest speaker</dt>
                <dd className="font-medium capitalize text-stone-900">
                  {currentTurn?.speaker ?? "none yet"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              Latest committed turn
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              {currentTurn?.text ?? "No committed transcript turns yet."}
            </p>
          </div>
        </div>

        <NextNudgeCandidatePanel
          selection={transcriptOrganization.nextNudge}
          title="Live next nudge"
          showBackups={false}
        />
      </div>
    </section>
  );
}
