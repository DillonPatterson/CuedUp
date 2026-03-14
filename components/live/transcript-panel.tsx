type TranscriptPanelProps = {
  sessionId: string;
};

export function TranscriptPanel({ sessionId }: TranscriptPanelProps) {
  return (
    <section className="panel min-h-80 p-6">
      <p className="eyebrow">Transcript panel</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Live turns for {sessionId}
      </h2>
      <p className="mt-3 text-stone-700">
        Placeholder shell for transcript streaming, turn-by-turn scoring, and
        operator review.
      </p>
    </section>
  );
}
