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
  const transcriptOrganization = useMemo(
    () => buildReplayTranscriptOrganization(transcriptTurns, {}, { handoff }),
    [handoff, transcriptTurns],
  );
  const currentTurn = transcriptTurns.at(-1) ?? null;
  const currentTurnSignals = currentTurn
    ? transcriptOrganization.sourceMetadataByTurnId[currentTurn.id] ?? null
    : null;

  return (
    <section className="panel min-h-[32rem] px-6 py-8 md:px-10 md:py-10">
      <ConversationMemoryPanel
        turns={transcriptTurns}
        currentTurn={currentTurn}
        currentTurnSignals={currentTurnSignals}
        organization={transcriptOrganization}
        modeLabel="live"
        listeningStateLabel="Not connected"
        sourceStateLabel="Mock transcript"
        positionLabel={`Committed turns ${transcriptTurns.length}`}
      />
    </section>
  );
}
