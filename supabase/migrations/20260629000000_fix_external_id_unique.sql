-- The partial unique index (WHERE external_id IS NOT NULL) can't be used as an
-- ON CONFLICT target by PostgREST. Replace it with a plain unique index on
-- (user_id, external_id). NULLs are distinct in Postgres, so manual sessions
-- (external_id NULL) remain unconstrained.
drop index if exists public.sessions_user_external_id_idx;
create unique index if not exists sessions_user_external_id_idx
  on public.sessions(user_id, external_id);
