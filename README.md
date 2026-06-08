# Rehab Logger

Mobile-first personal rehab and training tracker. Next.js (App Router) + Supabase + Tailwind.

## Setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at https://supabase.com and grab the Project URL + anon key.

3. **Configure env**
   ```bash
   cp .env.local.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
   # and (for the AI coach) GEMINI_API_KEY — grab one at https://aistudio.google.com/apikey
   ```

4. **Run the schema** — open the Supabase SQL editor and paste the contents of [`supabase/schema.sql`](supabase/schema.sql). Creates `sessions`, `gym_sets`, `rehab_followups`, `profiles`, `weekly_plans`, `chat_messages` plus row-level security policies that scope every row to `auth.uid()`.

5. **Create a user**
   - Easiest: enable Email auth in Supabase, then use the in-app "Sign up" link on `/login`. You may need to disable email confirmation in *Authentication → Providers → Email* for quick local use, or click through the confirmation email.

6. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Structure

```
src/
  app/
    layout.tsx                 root layout, fonts, metadata
    globals.css                tailwind + theme tokens (auto dark mode)
    middleware.ts not here — see src/middleware.ts
    login/                     unauthenticated entry
    (app)/                     authenticated app shell w/ bottom nav
      page.tsx                 Home
      add/                     Add training (grid + flows)
      calendar/                Month grid + per-day detail
      export/                  CSV / Excel
      follow-up/[id]/          Rehab check-in after a session
  components/
    bottom-nav.tsx
    ui/                        button, input, card, select, slider, label, textarea
  lib/
    constants.ts               exercises, set formats, pain locations, reactions
    utils.ts                   cn()
    supabase/                  client / server / middleware
  types/db.ts                  Session, GymSet, RehabFollowup
  middleware.ts                redirects unauthenticated traffic to /login
supabase/schema.sql            schema + RLS
```

## Data model

- `sessions` — one row per workout (`type`: gym | cycling | walking | football).
- `gym_sets` — one row per exercise inside a gym session (the 7 rehab exercises are seeded on session create).
- `rehab_followups` — one-to-one with `sessions`: pain score, location, reaction, RPE.

## Flow

- **Gym**: tap "Register training" → Gym → server creates the session and seeds the 7 exercises → swipe / arrow through 7 fullscreen cards (autosaves while you move) → Finish workout → rehab follow-up → Home.
- **Cycling / Walking / Football**: short form (duration, distance, notes) → rehab follow-up → Home.

## Export

`/export` lets you pick range (day / week / month / all) and download CSV or `.xlsx`. Columns:

```
date, training_type, exercise, sets, reps, weight, duration,
pain_score, pain_location, reaction, rpe, notes
```

One row per gym exercise, one row per cardio session — analysis-friendly long format.

## AI Coach

Routes under `/coach` (also reachable from the bottom nav):

- **Plan** (`/coach`) — generates a 7-day plan (Mon–Sun) for the current ISO week based on the last 14 days of training, follow-ups, and your profile. Stored per-week in `weekly_plans`, can be regenerated.
- **Chat** (`/coach/chat`) — short conversational coach. Each message rebuilds the same context (profile + last 14 days) before calling the model, so it always reflects your latest data. Last 20 turns are sent as history. Persisted in `chat_messages`.
- **Profile** (`/coach/profile`) — name, sex, age, weight, height, rehab focus, goals, free-form notes. This is the user context the AI reads on every request. Saved in `profiles`.

The system prompt and context formatter live in [`src/lib/ai/context.ts`](src/lib/ai/context.ts). The Gemini client is in [`src/lib/ai/gemini.ts`](src/lib/ai/gemini.ts) — plain `fetch`, no extra dependency.

**Model:** defaults to `gemini-2.5-flash` (free tier: 15 req/min, 1500 req/day). Override with `GEMINI_MODEL` (e.g. `gemini-2.5-pro` for higher quality).

## Notes

- No service-role key needed. The app uses only the anon key + RLS.
- Dark mode follows the OS preference.
- The bottom nav is fixed and respects iOS safe-area insets.
