import { notFound } from "next/navigation";
import { InterviewReplay } from "@/components/live/interview-replay";
import { getMockInterviewSession } from "@/lib/mock/interview-session";

type InterviewReplayPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewReplayPage({
  params,
}: InterviewReplayPageProps) {
  // Session-aware routing is not implemented yet. `sessionId` currently exists
  // for route shape and display only, while `getMockInterviewSession()` always
  // returns the same seeded mock session regardless of URL. The deeper mock
  // session explanation also lives in `lib/mock/interview-session.ts`.
  const { sessionId } = await params;
  const session = getMockInterviewSession();

  if (!session) {
    notFound();
  }

  return (
    <main className="shell px-4 py-10">
      <header className="mb-6">
        <p className="eyebrow">Replay/debug</p>
        <h1 className="text-4xl font-semibold text-stone-900">
          {session.guestName} replay surface
        </h1>
        <p className="mt-3 max-w-3xl text-stone-700">
          Developer and post-session inspection for deterministic transcript
          playback, engine state, and Presence Guard decisions.
        </p>
      </header>
      <InterviewReplay
        displaySessionId={sessionId}
        engineSessionId={session.engineSessionId}
        guestName={session.guestName}
        handoff={session.handoff}
        transcriptTurns={session.transcriptTurns}
      />
    </main>
  );
}
