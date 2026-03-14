import Link from "next/link";

const primaryLinks = [
  { href: "/dossier/test-guest", label: "Test guest dossier" },
  { href: "/interview/demo-session", label: "Live interview" },
  { href: "/recap/demo-session", label: "Session recap" },
];

const layers = [
  "App Router pages define the operator-facing surfaces.",
  "API routes accept validated payloads and return placeholder responses.",
  "lib/ owns domain schemas, integration helpers, prompts, and state contracts.",
  "Supabase migrations define the first-pass relational model.",
  "Inngest functions provide the background job seam for dossier and recap generation.",
];

export default function HomePage() {
  return (
    <main className="shell px-4 py-10 md:py-16">
      <section className="panel grid gap-8 px-6 py-8 md:grid-cols-[1.6fr_1fr] md:px-10">
        <div className="space-y-5">
          <p className="eyebrow">CuedUp prototype</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-stone-900 md:text-6xl">
            A clean foundation for live interview support.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-stone-700">
            This scaffold focuses on project structure, domain contracts, and
            integration seams so dossier generation, transcript analysis, and
            operator nudges can be built incrementally.
          </p>
          <div className="flex flex-wrap gap-3">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <aside className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
          <p className="eyebrow">Current scope</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
            <li>Minimal UI shells for core workflows.</li>
            <li>Schema-first contracts with Zod and inferred types.</li>
            <li>Supabase and Inngest placeholders without production logic.</li>
            <li>Working mock dossier guest at `/dossier/test-guest`.</li>
            <li>No authentication, audio pipeline, or advanced model routing.</li>
          </ul>
        </aside>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {layers.map((layer) => (
          <article key={layer} className="panel p-6">
            <p className="text-base leading-7 text-stone-700">{layer}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
