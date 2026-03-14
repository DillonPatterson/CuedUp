import type { ReactNode } from "react";

type PlaceholderCardProps = {
  title: string;
  children: ReactNode;
};

export function PlaceholderCard({ title, children }: PlaceholderCardProps) {
  return (
    <section className="panel p-6">
      <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
      <div className="mt-3 text-stone-700">{children}</div>
    </section>
  );
}
