-- Personal resting shin-tenderness baseline. Recovery is judged as "back to
-- baseline", which for a chronic low-grade case is not 0. Seeded at onboarding,
-- editable on the profile, and used as the recovery fallback baseline.
alter table public.profiles
  add column if not exists baseline_tenderness integer check (baseline_tenderness between 0 and 10);
