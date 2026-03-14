create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  story_veins jsonb not null default '[]'::jsonb,
  live_wires jsonb not null default '[]'::jsonb,
  forbidden_topics jsonb not null default '[]'::jsonb,
  contradiction_map jsonb not null default '[]'::jsonb,
  source_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists dossiers_guest_id_idx on public.dossiers (guest_id);
