type StoryVeinProgress = {
  id: string;
  title: string;
  saturation: number;
  status: "covered" | "in_progress" | "seeded";
};

type TopicMapProps = {
  sessionId: string;
  coveredVeins: string[];
  storyVeinProgress: StoryVeinProgress[];
  emotionalHeat: number;
  closureConfidence: number;
};

export function TopicMap({
  sessionId,
  coveredVeins,
  storyVeinProgress,
  emotionalHeat,
  closureConfidence,
}: TopicMapProps) {
  return (
    <section className="panel p-6">
      <p className="eyebrow">Coverage map</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Topic saturation
      </h2>
      <p className="mt-2 text-sm text-stone-600">Session {sessionId}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Emotional heat
          </p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">
            {emotionalHeat.toFixed(2)}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Closure confidence
          </p>
          <p className="mt-2 text-3xl font-semibold text-stone-900">
            {closureConfidence.toFixed(2)}
          </p>
        </article>
      </div>

      <div className="mt-5 space-y-3">
        {storyVeinProgress.map((vein) => (
          <article
            key={vein.id}
            className="rounded-2xl border border-stone-200 bg-white/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-stone-900">
                {vein.title}
              </h3>
              <span className="rounded-full bg-stone-100 px-2 py-1 text-xs uppercase tracking-[0.14em] text-stone-600">
                {vein.status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-stone-200">
              <div
                className="h-2 rounded-full bg-emerald-700"
                style={{ width: `${Math.round(vein.saturation * 100)}%` }}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
          Covered vein IDs
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {coveredVeins.length > 0 ? coveredVeins.join(", ") : "None covered yet."}
        </p>
      </div>
    </section>
  );
}
