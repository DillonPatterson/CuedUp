import type { ReactNode } from "react";
import type { Dossier, DossierLiveHandoff } from "@/types";

type DossierViewProps = {
  dossier: Dossier;
  inputSummary: string;
  liveHandoff: DossierLiveHandoff;
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
        {typeof count === "number" ? (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
      {label}
    </span>
  );
}

export function DossierView({
  dossier,
  inputSummary,
  liveHandoff,
}: DossierViewProps) {
  const veinTitleById = new Map(
    dossier.storyVeins.map((vein) => [vein.id, vein.title] as const),
  );

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <p className="eyebrow">Guest summary</p>
        <h2 className="mt-2 text-3xl font-semibold text-stone-900">
          {dossier.title}
        </h2>
        <p className="mt-4 text-lg leading-8 text-stone-700">
          {dossier.guestSummary}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MetaChip label={`Confidence: ${dossier.confidence}`} />
          <MetaChip label={`${dossier.storyVeins.length} story veins`} />
          <MetaChip label={`${dossier.sourceReferences.length} source refs`} />
        </div>
      </section>

      <Section title="Story veins" count={dossier.storyVeins.length}>
        {dossier.storyVeins.map((vein) => (
          <article
            key={vein.id}
            className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-stone-900">
                {vein.title}
              </h3>
              <MetaChip label={vein.theme} />
              <MetaChip label={vein.importance} />
              <MetaChip label={vein.status} />
              <MetaChip label={vein.sensitivity} />
              <MetaChip label={vein.confidence} />
            </div>
            <p className="mt-3 leading-7 text-stone-700">{vein.summary}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Entry points
                </p>
                <ul className="mt-2 space-y-2 text-stone-700">
                  {vein.suggestedEntryPoints.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Follow-ups
                </p>
                <ul className="mt-2 space-y-2 text-stone-700">
                  {vein.suggestedFollowUps.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </Section>

      <Section title="Live wires" count={dossier.liveWires.length}>
        {dossier.liveWires.map((wire) => (
          <article key={wire.id} className="rounded-2xl border border-stone-200 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-stone-900">
                {wire.label}
              </h3>
              <MetaChip label={wire.sensitivity} />
              <MetaChip label={wire.confidence} />
            </div>
            <p className="mt-3 leading-7 text-stone-700">{wire.whyItMatters}</p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
              Suggested approach
            </p>
            <p className="mt-2 leading-7 text-stone-700">
              {wire.suggestedApproach}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {wire.triggerPhrases.map((phrase) => (
                <MetaChip key={phrase} label={phrase} />
              ))}
            </div>
          </article>
        ))}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Contradictions" count={dossier.contradictions.length}>
          {dossier.contradictions.map((item) => (
            <article key={item.id} className="rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-stone-900">
                  {item.topic}
                </h3>
                <MetaChip label={item.severity} />
                <MetaChip label={item.confidence} />
              </div>
              <p className="mt-3 text-stone-700">
                <strong>Statement A:</strong> {item.statementA}
              </p>
              <p className="mt-2 text-stone-700">
                <strong>Statement B:</strong> {item.statementB}
              </p>
              <p className="mt-3 leading-7 text-stone-700">
                <strong>Suggested follow-up:</strong> {item.suggestedFollowUp}
              </p>
            </article>
          ))}
        </Section>

        <Section title="Unasked topics" count={dossier.unaskedTopics.length}>
          {dossier.unaskedTopics.map((topic) => (
            <article key={topic.id} className="rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-stone-900">
                  {topic.topic}
                </h3>
                <MetaChip label={topic.confidence} />
              </div>
              <p className="mt-3 text-stone-700">
                <strong>Why unasked:</strong> {topic.whyUnasked}
              </p>
              <p className="mt-2 text-stone-700">
                <strong>Opportunity:</strong> {topic.opportunity}
              </p>
              <ul className="mt-3 space-y-2 text-stone-700">
                {topic.suggestedPromptFragments.map((fragment) => (
                  <li key={fragment}>• {fragment}</li>
                ))}
              </ul>
            </article>
          ))}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Coverage notes" count={dossier.overusedTopics.length}>
          <p className="leading-7 text-stone-700">
            These topics already appear heavily in prior coverage and should be
            used selectively unless the interview introduces a new angle.
          </p>
          <div className="flex flex-wrap gap-2">
            {dossier.overusedTopics.map((topic) => (
              <MetaChip key={topic} label={topic} />
            ))}
          </div>
        </Section>

        <Section title="Audience hooks" count={dossier.audienceHooks.length}>
          {dossier.audienceHooks.map((hook) => (
            <article key={hook.id} className="rounded-2xl border border-stone-200 p-5">
              <h3 className="text-xl font-semibold text-stone-900">
                {hook.angle}
              </h3>
              <p className="mt-2 text-stone-700">
                <strong>Target audience:</strong> {hook.targetAudience}
              </p>
              <p className="mt-2 text-stone-700">{hook.whyItLands}</p>
              <p className="mt-2 text-stone-700">
                <strong>Suggested use:</strong> {hook.suggestedUse}
              </p>
            </article>
          ))}
        </Section>

        <Section title="Opening paths" count={dossier.openingPaths.length}>
          {dossier.openingPaths.map((path) => (
            <article key={path.id} className="rounded-2xl border border-stone-200 p-5">
              <h3 className="text-xl font-semibold text-stone-900">
                {path.label}
              </h3>
              <p className="mt-2 text-stone-700">
                <strong>Approach:</strong> {path.approach}
              </p>
              <p className="mt-2 text-stone-700">
                <strong>Why it works:</strong> {path.whyItWorks}
              </p>
              <p className="mt-2 leading-7 text-stone-700">
                <strong>First question seed:</strong> {path.firstQuestionSeed}
              </p>
            </article>
          ))}
        </Section>
      </div>

      <Section
        title="Follow-up opportunities"
        count={dossier.followUpOpportunities.length}
      >
        {dossier.followUpOpportunities.map((item) => (
          <article key={item.id} className="rounded-2xl border border-stone-200 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-stone-900">
                {item.momentType.replaceAll("_", " ")}
              </h3>
              {item.relatedVeinId ? (
                <MetaChip
                  label={veinTitleById.get(item.relatedVeinId) ?? item.relatedVeinId}
                />
              ) : null}
            </div>
            <ul className="mt-3 space-y-2 text-stone-700">
              {item.promptFragments.map((fragment) => (
                <li key={fragment}>• {fragment}</li>
              ))}
            </ul>
            <p className="mt-3 leading-7 text-stone-700">
              <strong>Why now:</strong> {item.whyNow}
            </p>
          </article>
        ))}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Source references" count={dossier.sourceReferences.length}>
          {dossier.sourceReferences.map((source) => (
            <article key={source.id} className="rounded-2xl border border-stone-200 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-stone-900">
                  {source.title}
                </h3>
                <MetaChip label={source.type} />
              </div>
              <p className="mt-2 leading-7 text-stone-700">{source.excerpt}</p>
              <p className="mt-2 text-stone-700">
                <strong>Relevance:</strong> {source.relevance}
              </p>
              {source.url ? (
                <a
                  className="mt-3 inline-block text-sm font-medium text-amber-800 underline"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                </a>
              ) : null}
            </article>
          ))}
        </Section>

        <Section title="Live handoff snapshot" count={liveHandoff.activeStoryVeins.length}>
          <p className="leading-7 text-stone-700">
            This is the subset that future live conversation logic will consume
            first: active story veins, live wires, contradiction candidates, and
            reusable follow-up fragments.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <MetaChip label={`${liveHandoff.liveWires.length} live wires`} />
            <MetaChip
              label={`${liveHandoff.contradictionCandidates.length} contradiction candidates`}
            />
            <MetaChip
              label={`${liveHandoff.followUpOpportunities.length} follow-ups`}
            />
            <MetaChip label={`${dossier.overusedTopics.length} overused topics`} />
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
              Input summary
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {inputSummary}
            </pre>
          </div>
        </Section>
      </div>
    </div>
  );
}
