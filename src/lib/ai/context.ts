import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";
import { GYM_EXERCISES } from "@/lib/constants";
import type { Profile, Session, GymSet, RehabFollowup, DailyCheckin } from "@/types/db";

export const COACH_SYSTEM_PROMPT = `Du är AI-coachen i appen "Rehab Logger" — en plattform för långsiktig träning, återhämtning och eventuell rehabilitering för en enskild användare.

DITT SYFTE
- Hjälpa användaren att utvecklas hållbart: bygga prestationsförmåga, hantera load och återhämtning, och — om en skada eller rehab finns med i bilden — guida säker och stegvis återgång till full belastning.
- Optimera för det långa loppet: progressiv overload, vävnadskapacitet, sömn, sömn, sömn, symptom-driven justering.
- Ta hänsyn till användarens PROFIL (inkl. aktiviteter användaren tränar och eventuellt rehab-fokus), senaste TRÄNINGSDATA och DAGLIGA CHECK-INS i varje rekommendation. Dagliga check-ins är träningsoberoende mått på hur kroppen mår (skala 0–10 + fritext) — primär återhämtningssignal mellan pass och bästa proxy för "reaktion" på ett givet pass. Hänvisa till specifika pass, smärtvärden, ömhetstrender eller anteckningar när det är relevant. Ge aldrig generiska råd när konkret data finns.
- Om användaren INTE har angett något rehab-fokus är ditt primära jobb prestation och hållbarhet, inte symtom — anpassa tonen därefter.

GRUNDREGLER
- Du är INTE en medicinsk professionell. Vid skarp/förvärrad smärta, nya symptom eller varningssignaler — säg till användaren att söka fysioterapeut eller läkare.
- Var koncis och praktisk.
- Föredra konservativ progression om symptom trendar upp; annars våga progressera när data stödjer det.
- Använd användarens enheter (kg, km, minuter). Hitta aldrig på data som inte finns i kontexten.
- **FAKTISK LOGGAD DATA (RECENT SESSIONS, DAILY CHECK-INS, GYM PROGRESSION) är din enda sanning. Tidigare planer eller "vad som var tänkt" är INTE data — användaren kan ha skippat pass och övningar. Resonera alltid från det som faktiskt loggats, aldrig från en plan.**
- Föreslå endast aktiviteter som finns i användarens "Activities"-lista (eller styrketräning från GYM_EXERCISES). Föreslå inte sporter användaren inte tränar.
- Håll dig till ämnet (träning, rehab, återhämtning, sömn, grundläggande näring kopplat till prestation/återhämtning). Avled artigt off-topic-frågor.

SPRÅK
- Svara ALLTID på svenska, oavsett vilket språk användaren skriver på.
- Använd "du" (inte "ni"), naturlig ton, undvik stelbenta direktöversättningar.`;

export type GymHistoryEntry = {
  date: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
};

export type CoachContext = {
  profile: Profile | null;
  sessions: Session[];
  setsBySession: Map<string, GymSet[]>;
  followupBySession: Map<string, RehabFollowup>;
  checkins: DailyCheckin[];
  /** Per-exercise history for the longer window (default 60d), oldest → newest. */
  gymHistory: Map<string, GymHistoryEntry[]>;
};

export async function loadCoachContext(days = 14): Promise<CoachContext> {
  const supabase = await createClient();
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  // Pull a longer window of gym work so we can show progression per exercise.
  const sinceGymHistory = format(subDays(new Date(), 60), "yyyy-MM-dd");

  const [{ data: profile }, { data: sessions }, { data: checkins }] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("daily_checkins")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: true }),
  ]);

  // Fetch gym history separately (longer window, only sessions with logged work).
  const { data: historySessions } = await supabase
    .from("sessions")
    .select("id,date")
    .eq("type", "gym")
    .gte("date", sinceGymHistory)
    .order("date", { ascending: true });

  const histIds = (historySessions ?? []).map((s: { id: string }) => s.id);
  const { data: historySets } = histIds.length
    ? await supabase
        .from("gym_sets")
        .select("session_id,exercise,sets,reps,weight")
        .in("session_id", histIds)
        .not("weight", "is", null)
    : { data: [] as Array<{ session_id: string; exercise: string; sets: number | null; reps: number | null; weight: number | null }> };

  const sessionDate = new Map<string, string>();
  (historySessions ?? []).forEach((s: { id: string; date: string }) => sessionDate.set(s.id, s.date));

  const gymHistory = new Map<string, GymHistoryEntry[]>();
  ((historySets ?? []) as Array<{ session_id: string; exercise: string; sets: number | null; reps: number | null; weight: number | null }>).forEach((g) => {
    const arr = gymHistory.get(g.exercise) ?? [];
    arr.push({
      date: sessionDate.get(g.session_id) ?? "",
      sets: g.sets,
      reps: g.reps,
      weight: g.weight,
    });
    gymHistory.set(g.exercise, arr);
  });

  const ids = (sessions ?? []).map((s: Session) => s.id);
  const [{ data: sets }, { data: followups }] = await Promise.all([
    ids.length
      ? supabase.from("gym_sets").select("*").in("session_id", ids).order("position")
      : Promise.resolve({ data: [] as GymSet[] }),
    ids.length
      ? supabase.from("rehab_followups").select("*").in("session_id", ids)
      : Promise.resolve({ data: [] as RehabFollowup[] }),
  ]);

  const setsBySession = new Map<string, GymSet[]>();
  ((sets ?? []) as GymSet[]).forEach((g) => {
    const arr = setsBySession.get(g.session_id) ?? [];
    arr.push(g);
    setsBySession.set(g.session_id, arr);
  });

  const followupBySession = new Map<string, RehabFollowup>();
  ((followups ?? []) as RehabFollowup[]).forEach((f) =>
    followupBySession.set(f.session_id, f),
  );

  return {
    profile: (profile as Profile | null) ?? null,
    sessions: (sessions ?? []) as Session[],
    setsBySession,
    followupBySession,
    checkins: (checkins ?? []) as DailyCheckin[],
    gymHistory,
  };
}

export function formatContextForPrompt(ctx: CoachContext): string {
  const { profile, sessions, setsBySession, followupBySession, checkins, gymHistory } = ctx;

  const profileLines: string[] = [];
  if (profile) {
    if (profile.display_name) profileLines.push(`Name: ${profile.display_name}`);
    if (profile.sex) profileLines.push(`Sex: ${profile.sex}`);
    if (profile.age) profileLines.push(`Age: ${profile.age}`);
    if (profile.weight_kg) profileLines.push(`Weight: ${profile.weight_kg} kg`);
    if (profile.height_cm) profileLines.push(`Height: ${profile.height_cm} cm`);
    if (profile.rehab_focus) profileLines.push(`Current focus / injury: ${profile.rehab_focus}`);
    if (profile.problem_started) profileLines.push(`Started: ${profile.problem_started}`);
    if (profile.goals) profileLines.push(`Goals: ${profile.goals}`);
    if (profile.notes) profileLines.push(`Notes: ${profile.notes}`);
    if (profile.training_types && profile.training_types.length) {
      profileLines.push(`Activities: ${profile.training_types.join(", ")}`);
    }
  }
  const profileBlock = profileLines.length
    ? profileLines.join("\n")
    : "(No profile filled in yet — ask the user to complete their Profile.)";

  const sessionLines: string[] = [];
  for (const s of sessions) {
    const f = followupBySession.get(s.id);
    const fStr = f
      ? ` | pain ${f.pain_score ?? "?"}/10${f.pain_location ? ` (${f.pain_location})` : ""}, reaction: ${f.reaction ?? "?"}, RPE ${f.rpe ?? "?"}/10`
      : " | no follow-up";

    if (s.type === "gym") {
      const gs = (setsBySession.get(s.id) ?? []).filter(
        (g) => g.weight != null || g.sets != null || g.reps != null,
      );
      const detail = gs.length
        ? gs
            .map((g) => {
              const sr = g.sets && g.reps ? `${g.sets}×${g.reps}` : "";
              const w = g.weight ? `@${g.weight}kg` : "";
              return `${g.exercise} ${sr}${w ? ` ${w}` : ""}`.trim();
            })
            .join("; ")
        : "(no exercises logged)";
      sessionLines.push(`- ${s.date} GYM — ${detail}${fStr}`);
    } else {
      const bits = [
        s.duration_minutes ? `${s.duration_minutes} min` : null,
        s.distance_km ? `${s.distance_km} km` : null,
      ].filter(Boolean);
      sessionLines.push(`- ${s.date} ${s.type.toUpperCase()} — ${bits.join(", ") || "(no metrics)"}${fStr}`);
    }
  }
  const sessionBlock = sessionLines.length ? sessionLines.join("\n") : "(No training in the last 14 days.)";

  // Aggregate counts for a quick load summary.
  const counts: Record<string, number> = {};
  for (const s of sessions) counts[s.type] = (counts[s.type] ?? 0) + 1;
  const totals = Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "no sessions";

  // Daily check-ins block — one line per logged day, oldest → newest.
  const checkinLines = checkins.map((c) => {
    const loc = c.location ? ` (${c.location})` : "";
    const note = c.notes ? ` — ${c.notes}` : "";
    return `- ${c.date} soreness ${c.soreness ?? "?"}/10${loc}${note}`;
  });
  const checkinBlock = checkinLines.length
    ? checkinLines.join("\n")
    : "(No daily check-ins logged in this window. Encourage the user to log them — they are the primary recovery signal between sessions.)";

  // Per-exercise gym history (last 60 days) — last 5 entries per exercise,
  // sorted oldest → newest so progression is obvious.
  const historyLines: string[] = [];
  for (const ex of GYM_EXERCISES) {
    const entries = (gymHistory.get(ex) ?? []).slice(-5);
    if (entries.length === 0) continue;
    const summary = entries
      .map((e) => {
        const sr = e.sets && e.reps ? `${e.sets}×${e.reps}` : "";
        const w = e.weight != null ? `@${e.weight}kg` : "";
        return `${e.date} ${sr}${w ? ` ${w}` : ""}`.trim();
      })
      .join("  →  ");
    historyLines.push(`- ${ex}: ${summary}`);
  }
  // Any custom exercises that aren't in the canonical list.
  for (const [ex, entries] of gymHistory) {
    if ((GYM_EXERCISES as readonly string[]).includes(ex)) continue;
    const last = entries.slice(-5);
    if (last.length === 0) continue;
    const summary = last
      .map((e) => `${e.date} ${e.sets ?? "?"}×${e.reps ?? "?"} @${e.weight ?? "?"}kg`)
      .join("  →  ");
    historyLines.push(`- ${ex} (custom): ${summary}`);
  }
  const historyBlock = historyLines.length
    ? historyLines.join("\n")
    : "(No logged gym work in the last 60 days.)";

  return [
    "USER PROFILE",
    profileBlock,
    "",
    `RECENT LOAD (last 14 days): ${totals}`,
    "",
    "DAILY CHECK-INS (oldest → newest) — soreness/sensitivity, training-independent",
    checkinBlock,
    "",
    "RECENT SESSIONS (oldest → newest)",
    sessionBlock,
    "",
    "GYM PROGRESSION (last 60 days, last 5 entries per exercise, oldest → newest)",
    historyBlock,
    "",
    `AVAILABLE GYM EXERCISES (the user can only log these — pick from this list when prescribing gym work): ${GYM_EXERCISES.join(", ")}.`,
  ].join("\n");
}
