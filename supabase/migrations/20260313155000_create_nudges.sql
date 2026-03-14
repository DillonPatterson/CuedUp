create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  type text not null,
  content text not null,
  ttl integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  consumed_at timestamptz,
  rejected_reason text
);

create index if not exists nudges_session_id_idx on public.nudges (session_id);
