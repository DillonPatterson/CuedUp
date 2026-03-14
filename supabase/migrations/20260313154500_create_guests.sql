create extension if not exists "pgcrypto";

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  display_name text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
