import { NudgeRail } from "@/components/live/nudge-rail";
import { ThreadBank } from "@/components/live/thread-bank";
import { TopicMap } from "@/components/live/topic-map";
import { TranscriptPanel } from "@/components/live/transcript-panel";

type InterviewPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { sessionId } = await params;

  return (
    <main className="shell px-4 py-10">
      <header className="mb-6">
        <p className="eyebrow">Live interview</p>
        <h1 className="text-4xl font-semibold text-stone-900">
          Session monitor for {sessionId}
        </h1>
        <p className="mt-3 max-w-3xl text-stone-700">
          This view is reserved for the real-time operator workspace: transcript,
          nudges, topic coverage, and unresolved thread tracking.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <TranscriptPanel sessionId={sessionId} />
        <NudgeRail sessionId={sessionId} />
        <ThreadBank sessionId={sessionId} />
        <TopicMap sessionId={sessionId} />
      </div>
    </main>
  );
}
