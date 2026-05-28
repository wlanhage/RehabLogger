-- Generalize app: training types become user-configurable, profile gets
-- onboarding completion timestamp, training types selection, and a
-- 'problem_started' note (when did the rehab issue begin).

-- 1) Drop the strict check constraint on sessions.type so users can log
--    arbitrary sport types (running, swimming, basketball, etc.).
alter table public.sessions drop constraint if exists sessions_type_check;

-- 2) Extend profiles with new fields.
alter table public.profiles add column if not exists onboarded_at timestamptz;
alter table public.profiles add column if not exists training_types text[] default array['gym','cycling','walking','football'];
alter table public.profiles add column if not exists problem_started text;

-- 3) Backfill: any existing profile with real data is considered onboarded.
update public.profiles
   set onboarded_at = now()
 where onboarded_at is null
   and (display_name is not null or rehab_focus is not null);

-- 4) Backfill training_types for any profile rows missing it.
update public.profiles
   set training_types = array['gym','cycling','walking','football']
 where training_types is null;
