"use client";

import { useMemo } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { ConversationMemoryPanel } from "@/components/live/conversation-memory-panel";
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
  void handoff;
  const transcriptOrganization = useMemo(
    () => buildReplayTranscriptOrganization(transcriptTurns, {}),
    [transcriptTurns],
  );
  const currentTurn = transcriptTurns.at(-1) ?? null;

  return (
    <section className="panel min-h-[32rem] px-6 py-8 md:px-10 md:py-10">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[12rem] items-center justify-center rounded-[2rem] border border-stone-200 bg-stone-50/70 px-6 py-8">
          <div className="h-16 w-full max-w-md rounded-2xl border border-dashed border-stone-200 bg-white/40" />
        </div>
        <ConversationMemoryPanel
          currentTurn={currentTurn}
          organization={transcriptOrganization}
          surfaceLabel="Live analyzer"
        />
      </div>
    </section>
  );
}
