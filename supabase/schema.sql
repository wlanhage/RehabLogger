-- Rehab Logger schema
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Training sessions
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default (current_date),
  -- Free-form slug; valid values are defined in src/lib/training-types.ts
  type text not null,
  duration_minutes integer,
  distance_km numeric(6,2),
  notes text,
  created_at timestamptz not null default now(),
  -- Load Intelligence fields
  rpe integer check (rpe between 1 and 10),
  running_minutes integer,
  surface text,
  shoes text,
  avg_hr integer,
  max_hr integer,
  calories integer,
  pace_seconds_per_km integer,
  body_kg numeric(5,2),
  imported_from text not null default 'manual',
  external_id text
);
create index if not exists sessions_user_date_idx on public.sessions(user_id, date desc);
create unique index if not exists sessions_user_external_id_idx
  on public.sessions(user_id, external_id) where external_id is not null;

-- Gym sets (one row per exercise in a gym session)
create table if not exists public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  exercise text not null,
  set_format text,
  sets integer,
  reps integer,
  weight numeric(6,2),
  notes text,
  skipped boolean not null default false
);
create index if not exists gym_sets_session_idx on public.gym_sets(session_id);

-- Rehab follow-up (one per session)
create table if not exists public.rehab_followups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pain_score integer check (pain_score between 0 and 10),
  pain_location text,
  reaction text,
  rpe integer check (rpe between 1 and 10),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.sessions enable row level security;
alter table public.gym_sets enable row level security;
alter table public.rehab_followups enable row level security;

create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own gym_sets" on public.gym_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rehab_followups" on public.rehab_followups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI coach: user profile context
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  sex text,
  age integer,
  weight_kg numeric(5,2),
  height_cm integer,
  rehab_focus text,
  problem_started text,
  goals text,
  notes text,
  training_types text[] default array['gym','cycling','walking','football'],
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI coach: weekly plans (one row per ISO week per user)
create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);
create index if not exists weekly_plans_user_idx on public.weekly_plans(user_id, week_start desc);
alter table public.weekly_plans enable row level security;
create policy "own weekly_plans" on public.weekly_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI coach: chat history
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_created_idx on public.chat_messages(user_id, created_at);
alter table public.chat_messages enable row level security;
create policy "own chat_messages" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily rehab check-ins (one per user per day, training-independent)
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  soreness integer check (soreness between 0 and 10),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Load Intelligence fields
  shin_tenderness_left integer check (shin_tenderness_left between 0 and 10),
  shin_tenderness_right integer check (shin_tenderness_right between 0 and 10),
  safe_to_run text check (safe_to_run in ('yes','unsure','no')),
  sleep_quality integer check (sleep_quality between 1 and 10),
  general_fatigue integer check (general_fatigue between 1 and 10),
  body_weight_kg numeric(5,2),
  unique(user_id, date)
);
create index if not exists daily_checkins_user_date_idx on public.daily_checkins(user_id, date desc);
alter table public.daily_checkins enable row level security;
create policy "own daily_checkins" on public.daily_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
