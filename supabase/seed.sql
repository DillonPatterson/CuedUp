insert into public.guests (id, slug, display_name, notes)
values (
  '11111111-1111-1111-1111-111111111111',
  'demo-guest',
  'Demo Guest',
  'Placeholder record for local development.'
)
on conflict (id) do nothing;
