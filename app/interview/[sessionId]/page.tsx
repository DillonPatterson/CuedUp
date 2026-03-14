import { notFound } from "next/navigation";
import { InterviewReplay } from "@/components/live/interview-replay";
import { generateMockDossierBundle } from "@/lib/dossier/generate";
import { DEFAULT_MOCK_GUEST_SLUG, getMockGuestSourceBySlug } from "@/lib/mock/guest-source";
import {
  MOCK_REPLAY_SESSION_ID,
  mockTranscriptTurns,
} from "@/lib/mock/transcript-turns";

type InterviewPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { sessionId } = await params;
  const source = getMockGuestSourceBySlug(DEFAULT_MOCK_GUEST_SLUG);

  if (!source) {
    notFound();
  }

  const bundle = generateMockDossierBundle(source);

  return (
    <main className="shell px-4 py-10">
      <header className="mb-6">
        <p className="eyebrow">Live interview</p>
        <h1 className="text-4xl font-semibold text-stone-900">
          Session monitor for {sessionId}
        </h1>
        <p className="mt-3 max-w-3xl text-stone-700">
          This view simulates live interview state from the deterministic replay
          engine. It uses the fixed `test-guest` dossier handoff plus mock
          transcript turns to show evolving threads, coverage, and next moves.
        </p>
      </header>
      <InterviewReplay
        displaySessionId={sessionId}
        engineSessionId={MOCK_REPLAY_SESSION_ID}
        guestName={bundle.input.guestName}
        handoff={bundle.liveHandoff}
        transcriptTurns={mockTranscriptTurns}
      />
    </main>
  );
}
