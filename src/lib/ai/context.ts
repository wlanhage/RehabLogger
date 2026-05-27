import { createClient } from "@/lib/supabase/server";
import { format, subDays } from "date-fns";
import type { Profile, Session, GymSet, RehabFollowup } from "@/types/db";

export const COACH_SYSTEM_PROMPT = `You are the AI coach inside "Rehab Logger" — a long-term rehabilitation and training-progression platform for a single end user.

YOUR PURPOSE
- Help the user safely rehabilitate their condition and progressively return to running and sport.
- Optimise for the long horizon: load management, tissue capacity, gradual progression, and symptom-driven adjustment.
- Take the user's PROFILE and recent TRAINING DATA into account in every recommendation. Reference specific sessions, pain scores, or trends when relevant — never give generic advice when concrete data is available.

GROUND RULES
- You are NOT a medical professional. For sharp/worsening pain, new symptoms, or red flags, tell the user to seek a physiotherapist or doctor.
- Be concise and practical. Bullet points and short paragraphs over walls of text.
- Prefer conservative progression. If pain trends up or reactions worsen, recommend backing off.
- Use units the user is already using (kg, km, minutes). Never invent data that isn't in the context.
- Stay on topic (rehab, training, recovery, sleep, nutrition basics as it relates to rehab). Politely redirect off-topic requests.

OUTPUT
- Use plain text or simple Markdown. No tables unless asked.
- When giving a weekly plan, structure it day-by-day (Mon–Sun) with intent, type, intensity guidance, and a brief "watch for" note tied to the user's symptoms.`;

export type CoachContext = {
  profile: Profile | null;
  sessions: Session[];
  setsBySession: Map<string, GymSet[]>;
  followupBySession: Map<string, RehabFollowup>;
};

export async function loadCoachContext(days = 14): Promise<CoachContext> {
  const supabase = await createClient();
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");

  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

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
  };
}

export function formatContextForPrompt(ctx: CoachContext): string {
  const { profile, sessions, setsBySession, followupBySession } = ctx;

  const profileLines: string[] = [];
  if (profile) {
    if (profile.display_name) profileLines.push(`Name: ${profile.display_name}`);
    if (profile.sex) profileLines.push(`Sex: ${profile.sex}`);
    if (profile.age) profileLines.push(`Age: ${profile.age}`);
    if (profile.weight_kg) profileLines.push(`Weight: ${profile.weight_kg} kg`);
    if (profile.height_cm) profileLines.push(`Height: ${profile.height_cm} cm`);
    if (profile.rehab_focus) profileLines.push(`Rehab focus: ${profile.rehab_focus}`);
    if (profile.goals) profileLines.push(`Goals: ${profile.goals}`);
    if (profile.notes) profileLines.push(`Notes: ${profile.notes}`);
  }
  const profileBlock = profileLines.length
    ? profileLines.join("\n")
    : "(No profile filled in yet — ask the user to complete /coach/profile.)";

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

  return [
    "USER PROFILE",
    profileBlock,
    "",
    `RECENT LOAD (last 14 days): ${totals}`,
    "",
    "RECENT SESSIONS (oldest → newest)",
    sessionBlock,
  ].join("\n");
}
