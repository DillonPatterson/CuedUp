import type { ReactNode } from "react";
import type { TranscriptTurn } from "@/types";
import type { ReplayCommittedTurnMetadata } from "@/lib/transcript/manual-turns";
import type {
  TranscriptOrganizationBucketItem,
  TranscriptOrganizationSnapshot,
  TranscriptOrganizationSourceMetadata,
  TranscriptRecallCandidate,
} from "@/lib/transcript/organization/types";

type ConversationMemoryPanelProps = {
  turns: TranscriptTurn[];
  currentTurn: TranscriptTurn | null;
  turnMetadata?: Record<string, ReplayCommittedTurnMetadata>;
  currentTurnSignals?: TranscriptOrganizationSourceMetadata | null;
  organization: TranscriptOrganizationSnapshot;
  modeLabel: "live" | "replay" | "manual";
  listeningStateLabel?: string;
  sourceStateLabel?: string | null;
  positionLabel?: string | null;
  statusActions?: ReactNode;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function truncateLabel(value: string, maxLength = 64) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function speakerLabel(speaker: TranscriptTurn["speaker"]) {
  return speaker.charAt(0).toUpperCase() + speaker.slice(1);
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
              {typeof item.completionDebtScore === "number" ? (
                <p className="mt-1 text-xs text-stone-600">
                  Debt {item.completionDebtScore} |{" "}
                  {formatLabel(item.bringBackPriority ?? "not_ready")} |{" "}
                  {item.affectiveWeight ?? "low"} affect
                  {item.interrupted ? " | interrupted" : ""}
                </p>
              ) : null}
              {item.completionDebtReasons?.length ? (
                <p className="mt-1 text-xs text-stone-500">
                  {item.completionDebtReasons
                    .slice(0, 2)
                    .map(formatLabel)
                    .join(", ")}
                </p>
              ) : null}
              {item.lastSeenAt ? (
                <p className="mt-1 text-xs text-stone-500">
                  Last seen {item.lastSeenAt}
                </p>
              ) : null}
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
    <article className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
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
                {item.recency} | {item.relevanceToCurrentTurn} relevance | debt{" "}
                {item.completionDebtScore}
              </p>
              {item.lastSeenAt ? (
                <p className="mt-1 text-xs text-stone-500">
                  Last seen {item.lastSeenAt}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-stone-500">
                {item.affectiveWeight} affect
                {item.interrupted ? " | interrupted" : ""}
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
  turns,
  currentTurn,
  turnMetadata = {},
  currentTurnSignals,
  organization,
  modeLabel,
  listeningStateLabel,
  sourceStateLabel,
  positionLabel,
  statusActions,
}: ConversationMemoryPanelProps) {
  const currentTurnCounts = buildCurrentTurnCounts(
    organization.annotations,
    currentTurn?.id ?? null,
  );

  return (
    <section id="conversation-workspace" className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Conversation workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">
            Live conversation memory
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Derived from committed transcript turns only. Raw transcript stays canonical.
          </p>
          {positionLabel ? (
            <p className="mt-2 text-sm text-amber-800">{positionLabel}</p>
          ) : null}
        </div>
        {statusActions ? <div className="flex flex-wrap gap-2">{statusActions}</div> : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Listening
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {listeningStateLabel ?? "Not connected"}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Committed turns
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {turns.length}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Mode
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {modeLabel}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Source state
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {sourceStateLabel ?? "Committed transcript"}
          </p>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.2fr_0.9fr]">
        <aside
          id="workspace-transcript-rail"
          className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Transcript rail
          </p>
          {turns.length > 0 ? (
            <div className="mt-3 max-h-[42rem] space-y-2 overflow-y-auto pr-1">
              {turns.map((turn) => (
                <article
                  key={turn.id}
                  className={`rounded-xl border px-3 py-3 ${
                    currentTurn?.id === turn.id
                      ? "border-amber-300 bg-amber-50"
                      : "border-stone-200 bg-white/90"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-500">
                    <span>{speakerLabel(turn.speaker)}</span>
                    <span>{turn.timestamp}</span>
                    <span>
                      {turnMetadata[turn.id]?.label ?? "Committed transcript"}
                    </span>
                    {currentTurn?.id === turn.id ? <span>Latest turn</span> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-800">
                    {turn.text}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">
              No committed turns yet.
            </p>
          )}
        </aside>

        <section className="rounded-2xl border border-stone-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Conversation memory board
          </p>
          <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-950 px-4 py-4 text-stone-100">
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
                  {currentTurnSignals ? (
                    <>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Salience {currentTurnSignals.memory.salience}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Specificity {currentTurnSignals.analysis.specificityBand}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Cue {currentTurnSignals.analysis.cuePotential}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Thread {formatLabel(currentTurnSignals.analysis.threadAction)}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Emotion{" "}
                        {formatLabel(currentTurnSignals.analysis.affective.dominantEmotion)}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Affect {currentTurnSignals.analysis.affective.intensity}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Valence {currentTurnSignals.analysis.affective.valence}
                      </span>
                      <span className="rounded-full bg-stone-800 px-3 py-1">
                        Completion{" "}
                        {formatLabel(
                          currentTurnSignals.analysis.completion.completionStatus,
                        )}
                      </span>
                    </>
                  ) : null}
                </div>
                {currentTurnSignals?.analysis.interruption.interruptedPreviousTurn ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-amber-300">
                    Interruption:{" "}
                    {formatLabel(currentTurnSignals.analysis.interruption.reason)}
                  </p>
                ) : null}
                {currentTurnSignals &&
                currentTurnSignals.analysis.affective.triggerTerms.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-stone-300">
                    {currentTurnSignals.analysis.affective.triggerTerms
                      .slice(0, 3)
                      .map((hit) => (
                        <span
                          key={`${hit.source}:${hit.tier}:${hit.term}`}
                          className="rounded-full bg-stone-800 px-3 py-1"
                        >
                          {hit.term} | {formatLabel(hit.tier)}
                        </span>
                      ))}
                  </div>
                ) : null}
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
                Waiting for a committed turn before the workspace can organize memory.
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
          </div>
        </section>

        <RecallList items={organization.recallCandidates} />
      </div>
    </section>
  );
}
