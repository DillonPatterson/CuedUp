type NudgeRailProps = {
  sessionId: string;
};

export function NudgeRail({ sessionId }: NudgeRailProps) {
  return (
    <aside className="panel min-h-80 p-6">
      <p className="eyebrow">Nudge rail</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Active nudges for {sessionId}
      </h2>
      <p className="mt-3 text-stone-700">
        Placeholder shell for concise operator cues, timing controls, and
        nudge lifecycle tracking.
      </p>
    </aside>
  );
}
