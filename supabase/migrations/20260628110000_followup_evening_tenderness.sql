-- Repurpose the post-session follow-up to capture same-evening shin tenderness,
-- which seeds the recovery-lag model (the delayed signal that matters).
alter table public.rehab_followups
  add column if not exists shin_tenderness_left  integer check (shin_tenderness_left  between 0 and 10),
  add column if not exists shin_tenderness_right integer check (shin_tenderness_right between 0 and 10);
