type RecapPageProps = {
  params: Promise<{ sessionId: string }>;
};

const recapSections = [
  "Key moments and story turns",
  "Coverage gaps and missed opportunities",
  "Candidate follow-up threads",
];

export default async function RecapPage({ params }: RecapPageProps) {
  const { sessionId } = await params;

  return (
    <main className="shell px-4 py-10">
      <header className="mb-6">
        <p className="eyebrow">Session recap</p>
        <h1 className="text-4xl font-semibold text-stone-900">
          Recap workspace for {sessionId}
        </h1>
        <p className="mt-3 max-w-2xl text-stone-700">
          This page will hold generated recaps and editor review tools once the
          background job layer is implemented.
        </p>
      </header>
      <section className="grid gap-4">
        {recapSections.map((section) => (
          <article key={section} className="panel p-6">
            <h2 className="text-xl font-semibold text-stone-900">{section}</h2>
            <p className="mt-2 text-stone-700">
              Placeholder section for future recap output and review controls.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
