import { notFound } from "next/navigation";
import { InterviewLive } from "@/components/live/interview-live";
import { getMockInterviewSession } from "@/lib/mock/interview-session";

type InterviewPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { sessionId } = await params;
  void sessionId;
  const session = getMockInterviewSession();

  if (!session) {
    notFound();
  }

  return (
    <main className="shell px-4 py-10 md:py-14">
      <InterviewLive
        engineSessionId={session.engineSessionId}
        handoff={session.handoff}
        transcriptTurns={session.transcriptTurns}
      />
    </main>
  );
}
