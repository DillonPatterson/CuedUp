import { notFound } from "next/navigation";
import { InterviewReplay } from "@/components/live/interview-replay";
import { getMockInterviewSession } from "@/lib/mock/interview-session";
import { buildFreshReplayHandoff } from "@/lib/replay/fresh-workspace";

type InterviewReplayPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ newInterview?: string }>;
};

export default async function InterviewReplayPage({
  params,
  searchParams,
}: InterviewReplayPageProps) {
  // Session-aware routing is not implemented yet. `sessionId` currently exists
  // for route shape and display only, while `getMockInterviewSession()` always
  // returns the same seeded mock session regardless of URL. The deeper mock
  // session explanation also lives in `lib/mock/interview-session.ts`.
  const { sessionId } = await params;
  const { newInterview } = await searchParams;
  const session = getMockInterviewSession();
  const isFreshInterview = newInterview === "1";

  if (!session) {
    notFound();
  }

  return (
    <main className="mx-auto w-[min(1380px,calc(100%-2rem))] px-4 py-8">
      <header className="mb-6">
        <p className="eyebrow">Replay/debug</p>
        <h1 className="text-4xl font-semibold text-stone-900">
          {isFreshInterview ? "Fresh interview workspace" : "Replay surface"}
        </h1>
        <p className="mt-3 max-w-3xl text-stone-700">
          {isFreshInterview
            ? "Blank replay workspace for real speech capture, live sorting preview, and committed-turn inspection."
            : "Developer and post-session inspection for deterministic transcript playback, engine state, and Presence Guard decisions."}
        </p>
      </header>
      <InterviewReplay
        displaySessionId={isFreshInterview ? "fresh-interview" : sessionId}
        engineSessionId={session.engineSessionId}
        guestName={isFreshInterview ? "Fresh interview" : session.guestName}
        handoff={isFreshInterview ? buildFreshReplayHandoff() : session.handoff}
        transcriptTurns={isFreshInterview ? [] : session.transcriptTurns}
        initialIsFreshInterview={isFreshInterview}
      />
    </main>
  );
}
