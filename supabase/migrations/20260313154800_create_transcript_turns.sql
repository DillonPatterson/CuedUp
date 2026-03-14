create table if not exists public.transcript_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  turn_timestamp timestamptz not null default timezone('utc', now()),
  speaker text not null,
  text text not null,
  energy_score numeric(4,3),
  specificity_score numeric(4,3),
  evasion_score numeric(4,3),
  novelty_score numeric(4,3),
  thread_id_link uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists transcript_turns_session_id_idx on public.transcript_turns (session_id);
