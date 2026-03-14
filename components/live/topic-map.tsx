type TopicMapProps = {
  sessionId: string;
};

export function TopicMap({ sessionId }: TopicMapProps) {
  return (
    <section className="panel p-6">
      <p className="eyebrow">Topic map</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Coverage map
      </h2>
      <p className="mt-3 text-stone-700">
        Placeholder shell for covered veins, live wires, and conversational
        heat signals for session {sessionId}.
      </p>
    </section>
  );
}
