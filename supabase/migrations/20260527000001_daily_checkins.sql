-- Daily check-ins: one row per user per day, independent of training.
-- Captures soreness/sensitivity so we get rest-day signal too.

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  soreness integer check (soreness between 0 and 10),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);
create index if not exists daily_checkins_user_date_idx on public.daily_checkins(user_id, date desc);

alter table public.daily_checkins enable row level security;
create policy "own daily_checkins" on public.daily_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
