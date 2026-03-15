import type { TranscriptTurn } from "@/types";
import type { ReplayCommittedTurnMetadata } from "@/lib/transcript/manual-turns";
import type {
  TranscriptOrganizationBucketItem,
  TranscriptOrganizationSnapshot,
  TranscriptRecallCandidate,
} from "@/lib/transcript/organization/types";

type ConversationMemoryPanelProps = {
  currentTurn: TranscriptTurn | null;
  currentTurnMetadata?: ReplayCommittedTurnMetadata | null;
  organization: TranscriptOrganizationSnapshot;
  surfaceLabel: string;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function truncateLabel(value: string, maxLength = 64) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function buildCurrentTurnCounts(
  items: TranscriptOrganizationSnapshot["annotations"],
  currentTurnId: string | null,
) {
  const turnAnnotations = currentTurnId
    ? items.filter((annotation) => annotation.turnId === currentTurnId)
    : [];

  return {
    annotations: turnAnnotations,
    themeCount: turnAnnotations.filter((annotation) => annotation.kind === "theme").length,
    threadCount: turnAnnotations.filter((annotation) => annotation.kind === "thread_cue").length,
    claimCount: turnAnnotations.filter((annotation) => annotation.kind === "claim").length,
    tensionCount: turnAnnotations.filter((annotation) => annotation.kind === "tension").length,
  };
}

function BucketList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: TranscriptOrganizationBucketItem[];
  emptyText: string;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
        {title}
      </p>
      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-stone-200 bg-white/90 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-stone-900">
                  {truncateLabel(item.label)}
                </p>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-600">
                  {item.occurrenceCount}x
                </span>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-stone-500">
                {formatLabel(item.sourceKind)} | salience {item.salience}
                {item.currentTurnLinked ? " | current turn" : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-600">{emptyText}</p>
      )}
    </article>
  );
}

function RecallList({
  items,
}: {
  items: TranscriptRecallCandidate[];
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 md:col-span-2">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
        Recall candidates
      </p>
      {items.length > 0 ? (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-stone-200 bg-white/90 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-stone-900">
                  {truncateLabel(item.label)}
                </p>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-900">
                  {formatLabel(item.readiness)}
                </span>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-stone-500">
                {formatLabel(item.sourceKind)} | salience {item.salience} |{" "}
                {item.recency} | {item.relevanceToCurrentTurn} relevance
              </p>
              <p className="mt-1 text-xs text-stone-600">{item.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          No recall candidates are ready yet.
        </p>
      )}
    </article>
  );
}

export function ConversationMemoryPanel({
  currentTurn,
  currentTurnMetadata,
  organization,
  surfaceLabel,
}: ConversationMemoryPanelProps) {
  const currentTurnCounts = buildCurrentTurnCounts(
    organization.annotations,
    currentTurn?.id ?? null,
  );

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Conversation memory</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            Analyzer panel
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {surfaceLabel} | Derived from committed transcript turns only.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-950 px-4 py-4 text-stone-100">
        <p className="text-xs uppercase tracking-[0.16em] text-amber-300">
          Current turn quick analysis
        </p>
        {currentTurn ? (
          <>
            <p className="mt-3 text-lg leading-7 text-stone-50">
              {truncateLabel(currentTurn.text, 120)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-300">
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Themes {currentTurnCounts.themeCount}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Threads {currentTurnCounts.threadCount}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Claims {currentTurnCounts.claimCount}
              </span>
              <span className="rounded-full bg-stone-800 px-3 py-1">
                Tension {currentTurnCounts.tensionCount}
              </span>
              {currentTurnMetadata ? (
                <>
                  <span className="rounded-full bg-stone-800 px-3 py-1">
                    Salience {currentTurnMetadata.memory.salience}
                  </span>
                  <span className="rounded-full bg-stone-800 px-3 py-1">
                    Cue {currentTurnMetadata.analysis.cuePotential}
                  </span>
                  <span className="rounded-full bg-stone-800 px-3 py-1">
                    Thread {formatLabel(currentTurnMetadata.analysis.threadAction)}
                  </span>
                </>
              ) : null}
            </div>
            {currentTurnCounts.annotations.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-300">
                {currentTurnCounts.annotations.slice(0, 5).map((annotation) => (
                  <span
                    key={annotation.id}
                    className="rounded-full bg-stone-800 px-3 py-1"
                  >
                    {formatLabel(annotation.kind)}: {truncateLabel(annotation.label, 44)}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-stone-300">
            Waiting for a committed turn before the analyzer can organize memory.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <BucketList
          title="Emerging themes"
          items={organization.emergingThemes}
          emptyText="No repeated theme has surfaced yet."
        />
        <BucketList
          title="Open threads"
          items={organization.openThreads}
          emptyText="No unresolved thread cue is active yet."
        />
        <BucketList
          title="Notable claims"
          items={organization.notableClaims}
          emptyText="No notable claim is available yet."
        />
        <BucketList
          title="Contradiction watch"
          items={organization.tensionWatch}
          emptyText="No tension cue is being tracked yet."
        />
        <RecallList items={organization.recallCandidates} />
      </div>
    </section>
  );
}
