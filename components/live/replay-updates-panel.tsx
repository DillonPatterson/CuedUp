"use client";

import { useEffect, useState } from "react";

type ReplayUpdateFile = {
  path: string;
  statText: string;
  kind: "engine" | "ui" | "fixture" | "other";
  impact: string;
};

type ReplayUpdatesResponse = {
  commitHash: string | null;
  commitMessage: string | null;
  relativeTime: string | null;
  files: ReplayUpdateFile[];
  uncommittedFiles: string[];
};

type ReplayUpdatesPanelProps = {
  onClose?: () => void;
};

const KIND_STYLES: Record<ReplayUpdateFile["kind"], string> = {
  engine: "border-amber-300 bg-amber-50 text-amber-950",
  ui: "border-sky-300 bg-sky-50 text-sky-950",
  fixture: "border-emerald-300 bg-emerald-50 text-emerald-950",
  other: "border-stone-300 bg-stone-100 text-stone-700",
};

export function ReplayUpdatesPanel({
  onClose,
}: ReplayUpdatesPanelProps) {
  const [data, setData] = useState<ReplayUpdatesResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/dev/replay-updates", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) =>
        response.ok ? (response.json() as Promise<ReplayUpdatesResponse>) : null,
      )
      .then((value) => {
        if (value) {
          setData(value);
        }
      })
      .catch(() => null);

    return () => controller.abort();
  }, []);

  if (!data?.commitHash || !data.commitMessage || !data.relativeTime) {
    return null;
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="eyebrow">Updates</p>
          <span className="font-mono text-xs text-stone-500">
            {data.commitHash.slice(0, 7)}
          </span>
          <span className="text-xs text-stone-500">{data.relativeTime}</span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-stone-700"
          >
            Close
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-stone-900">
        {data.commitMessage}
      </p>

      <div className="mt-4 space-y-2">
        {data.files.map((file) => (
          <article
            key={file.path}
            className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${KIND_STYLES[file.kind]}`}
              >
                {file.kind}
              </span>
              <span className="font-mono text-xs text-stone-600">{file.path}</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-stone-700">{file.impact}</p>
          </article>
        ))}
      </div>

      {data.uncommittedFiles.length > 0 ? (
        <p className="mt-4 text-xs leading-5 text-stone-500">
          Uncommitted: {data.uncommittedFiles.join(", ")}
        </p>
      ) : null}
    </section>
  );
}
