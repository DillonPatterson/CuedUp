import { notFound } from "next/navigation";
import { DossierView } from "@/components/dossier/dossier-view";
import { SourceUpload } from "@/components/dossier/source-upload";
import { PlaceholderCard } from "@/components/ui/placeholder-card";
import { generateMockDossierBundle } from "@/lib/dossier/generate";
import { getMockGuestSourceBySlug } from "@/lib/mock/guest-source";

type DossierPageProps = {
  params: Promise<{ guestId: string }>;
};

export default async function DossierPage({ params }: DossierPageProps) {
  const { guestId: guestSlug } = await params;
  const source = getMockGuestSourceBySlug(guestSlug);

  if (!source) {
    notFound();
  }

  const bundle = generateMockDossierBundle(source);

  return (
    <main className="shell px-4 py-10">
      <header className="mb-6">
        <p className="eyebrow">Guest dossier</p>
        <h1 className="text-4xl font-semibold text-stone-900">
          Dossier workspace for {bundle.input.guestName}
        </h1>
        <p className="mt-3 max-w-3xl text-stone-700">
          Development workflow: source material is summarized into a long-context
          prompt contract, run through the deterministic mock generator, validated
          against the dossier schema, and then prepared for future live
          conversation-state logic.
        </p>
      </header>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <PlaceholderCard title="Prompt contract">
          <p className="leading-7">
            Structured extraction instructions are ready for a future long-context
            model. The current page uses the same contract for deterministic mock
            output.
          </p>
        </PlaceholderCard>
        <PlaceholderCard title="Persistence shape">
          <p className="leading-7">
            The dossier is already convertible into a persistence-friendly shape
            for the current prototype tables, while richer fields remain explicit
            in a deferred bucket.
          </p>
        </PlaceholderCard>
        <PlaceholderCard title="Live handoff">
          <p className="leading-7">
            {bundle.liveHandoff.activeStoryVeins.length} active veins,{" "}
            {bundle.liveHandoff.liveWires.length} live wires,{" "}
            {bundle.liveHandoff.contradictionCandidates.length} contradiction
            candidates, and{" "}
            {bundle.liveHandoff.followUpOpportunities.length} prepared follow-ups.
          </p>
        </PlaceholderCard>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
        <DossierView
          dossier={bundle.dossier}
          inputSummary={bundle.inputSummary}
          liveHandoff={bundle.liveHandoff}
        />
        <SourceUpload
          guestId={bundle.input.guestId}
          guestSlug={bundle.input.guestSlug}
          initialSources={bundle.input.sources}
          promptPreview={bundle.prompt}
        />
      </div>
    </main>
  );
}
