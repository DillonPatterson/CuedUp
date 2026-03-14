type ThreadBankProps = {
  sessionId: string;
};

export function ThreadBank({ sessionId }: ThreadBankProps) {
  return (
    <section className="panel p-6">
      <p className="eyebrow">Thread bank</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Unresolved threads
      </h2>
      <p className="mt-3 text-stone-700">
        Placeholder shell for tracking open topics, callbacks, and unresolved
        narrative arcs in session {sessionId}.
      </p>
    </section>
  );
}
