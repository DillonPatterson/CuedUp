create table if not exists public.conversation_states (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  covered_veins jsonb not null default '[]'::jsonb,
  active_threads jsonb not null default '[]'::jsonb,
  emotional_heat numeric(4,3) not null default 0,
  closure_confidence numeric(4,3) not null default 0,
  current_mode text not null default 'explore',
  last_meaningful_shift_at timestamptz,
  stale_nudge_guard boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);
