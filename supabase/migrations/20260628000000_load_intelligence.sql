-- Load Intelligence Platform: extend daily_checkins + sessions for the
-- recovery-lag / tibial-load decision engine. No new tables — recovery
-- responses and load scores are derived in TS from this data.

-- 1) Daily check-in: shin-specific tenderness + run-safety self-assessment.
alter table public.daily_checkins
  add column if not exists shin_tenderness_left  integer check (shin_tenderness_left  between 0 and 10),
  add column if not exists shin_tenderness_right integer check (shin_tenderness_right between 0 and 10),
  add column if not exists safe_to_run text check (safe_to_run in ('yes','unsure','no')),
  add column if not exists sleep_quality integer check (sleep_quality between 1 and 10),
  add column if not exists body_weight_kg numeric(5,2);

-- 2) Sessions: fields the load model and Apple Watch import need.
alter table public.sessions
  add column if not exists rpe integer check (rpe between 1 and 10),
  add column if not exists running_minutes integer,      -- jog minutes inside a run/walk session
  add column if not exists surface text,                 -- asphalt|gravel|treadmill|grass|mixed
  add column if not exists shoes text,
  add column if not exists avg_hr integer,
  add column if not exists max_hr integer,
  add column if not exists calories integer,
  add column if not exists pace_seconds_per_km integer,
  add column if not exists body_kg numeric(5,2),         -- body-weight snapshot for load scaling
  add column if not exists imported_from text not null default 'manual';

-- 3) Backfill RPE onto sessions from the existing one-to-one rehab_followups.
update public.sessions s
   set rpe = f.rpe
  from public.rehab_followups f
 where f.session_id = s.id
   and s.rpe is null
   and f.rpe is not null;

-- 4) External id for idempotent Apple Health / webhook imports.
alter table public.sessions
  add column if not exists external_id text;
create unique index if not exists sessions_user_external_id_idx
  on public.sessions(user_id, external_id)
  where external_id is not null;
