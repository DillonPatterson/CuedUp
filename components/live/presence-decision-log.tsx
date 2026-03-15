import type { PresenceGuardDecision } from "@/types";

type PresenceDecisionLogProps = {
  currentDecision: PresenceGuardDecision;
  guardDecisions: PresenceGuardDecision[];
  recentDecisions: PresenceGuardDecision[];
};

function formatReasons(decision: PresenceGuardDecision) {
  if (decision.reasons.length === 0) {
    return "surfaced";
  }

  return decision.reasons.join(", ").replaceAll("_", " ");
}

export function PresenceDecisionLog({
  currentDecision,
  guardDecisions,
  recentDecisions,
}: PresenceDecisionLogProps) {
  return (
    <section className="panel p-6">
      <p className="eyebrow">Presence guard</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">
        Cue decisions
      </h2>

      <article className="mt-5 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-stone-500">
          <span>{currentDecision.outcome}</span>
          <span>{currentDecision.timestamp}</span>
        </div>
        <p className="mt-3 text-lg font-semibold text-stone-900">
          {currentDecision.formattedCue ?? currentDecision.candidateLabel ?? "No cue"}
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {formatReasons(currentDecision)}
        </p>
      </article>

      <div className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Current turn evaluations
        </p>
        <div className="mt-3 space-y-3">
          {guardDecisions.map((decision, index) => (
            <article
              key={`${decision.timestamp}:${decision.candidateId ?? "none"}:${index}`}
              className={`rounded-2xl border p-4 ${
                decision === currentDecision
                  ? "border-amber-300 bg-amber-50/70"
                  : "border-stone-200 bg-white/80"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-stone-500">
                <span>{decision.outcome}</span>
                <span>{decision.timestamp}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                {decision.formattedCue ?? decision.candidateLabel ?? "No cue"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {formatReasons(decision)}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Recent prior decisions
        </p>
        <div className="mt-3 space-y-3">
        {recentDecisions.map((decision) => (
          <article
            key={`${decision.timestamp}:${decision.candidateId ?? "none"}`}
            className="rounded-2xl border border-stone-200 bg-white/80 p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-stone-500">
              <span>{decision.outcome}</span>
              <span>{decision.timestamp}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-stone-900">
              {decision.formattedCue ?? decision.candidateLabel ?? "No cue"}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              {formatReasons(decision)}
            </p>
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}
