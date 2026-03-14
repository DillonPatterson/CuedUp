"use client";

import { useEffect, useMemo, useState } from "react";
import type { DossierLiveHandoff, TranscriptTurn } from "@/types";
import { buildInterviewSessionTimeline } from "@/lib/state/interview-session-timeline";

type InterviewLiveProps = {
  engineSessionId: string;
  handoff: DossierLiveHandoff;
  transcriptTurns: TranscriptTurn[];
};

const LIVE_ADVANCE_INTERVAL_SECONDS = 20;

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function InterviewLive({
  engineSessionId,
  handoff,
  transcriptTurns,
}: InterviewLiveProps) {
  const timeline = useMemo(
    () => buildInterviewSessionTimeline(engineSessionId, handoff, transcriptTurns),
    [engineSessionId, handoff, transcriptTurns],
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const snapshotIndex = Math.min(
    Math.floor(elapsedSeconds / LIVE_ADVANCE_INTERVAL_SECONDS),
    timeline.snapshots.length - 1,
  );
  const snapshot = timeline.snapshots[snapshotIndex];

  return (
    <section className="panel min-h-[32rem] px-6 py-8 md:px-10 md:py-10">
      <div className="flex items-center justify-end">
        <p className="text-sm font-medium tabular-nums tracking-[0.18em] text-stone-500">
          {formatElapsedTime(elapsedSeconds)}
        </p>
      </div>

      <div className="mt-14 flex min-h-[12rem] items-center justify-center rounded-[2rem] border border-stone-200 bg-stone-50/70 px-6 py-8">
        {snapshot.surfaceCue ? (
          <p className="text-center text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
            {snapshot.surfaceCue.text}
          </p>
        ) : (
          <div className="h-16 w-full max-w-md rounded-2xl border border-dashed border-stone-200 bg-white/40" />
        )}
      </div>

      <div className="mt-16 flex items-center justify-center gap-4">
        {snapshot.threadIndicators.map((indicator) => (
          <span
            key={indicator.id}
            className={`h-4 w-4 rounded-full ${
              indicator.urgency === "active" ? "bg-amber-700" : "bg-stone-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
