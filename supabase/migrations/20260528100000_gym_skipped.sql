-- Per-exercise skip flag for gym sessions.
-- A skipped exercise carries no data — it's an intentional "did not do today".

alter table public.gym_sets
  add column if not exists skipped boolean not null default false;
