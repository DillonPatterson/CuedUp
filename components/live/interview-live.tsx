"use client";

import type { DossierLiveHandoff, TranscriptTurn } from "@/types";

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
  void handoff;
  void transcriptTurns;

  return (
    <section className="panel min-h-[32rem] px-6 py-8 md:px-10 md:py-10">
      <div className="flex min-h-[12rem] items-center justify-center rounded-[2rem] border border-stone-200 bg-stone-50/70 px-6 py-8">
        <div className="h-16 w-full max-w-md rounded-2xl border border-dashed border-stone-200 bg-white/40" />
      </div>
    </section>
  );
}
