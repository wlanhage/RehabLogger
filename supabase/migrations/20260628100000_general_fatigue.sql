-- General fatigue on the morning check-in (spec'd 1–10, separate from sleep).
alter table public.daily_checkins
  add column if not exists general_fatigue integer check (general_fatigue between 1 and 10);
