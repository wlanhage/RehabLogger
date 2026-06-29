"use server";
import { createClient } from "@/lib/supabase/server";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { computeSessionLoad } from "@/lib/load/load";

export type ExportRow = {
  date: string;
  /** "gym" | "cycling" | "walking" | "football" | "checkin" */
  training_type: string;
  exercise: string;
  sets: number | string;
  reps: number | string;
  weight: number | string;
  duration: number | string;
  /** Tibial load (AU) for the whole session — repeated on each gym-exercise row. */
  tibial_load: number | string;
  pain_score: number | string;
  rpe: number | string;
  daily_soreness: number | string;
  notes: string;
};

export type ExportRange = "day" | "week" | "month" | "all";

function rangeBounds(range: ExportRange, anchor: Date) {
  if (range === "day") return { from: anchor, to: anchor };
  if (range === "week")
    return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  if (range === "month") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return null;
}

export async function fetchExportRows(range: ExportRange, anchorISO: string): Promise<ExportRow[]> {
  const supabase = await createClient();
  const anchor = new Date(anchorISO);
  const bounds = rangeBounds(range, anchor);

  let sessionsQ = supabase.from("sessions").select("*").order("date", { ascending: true });
  let checkinsQ = supabase.from("daily_checkins").select("*").order("date", { ascending: true });
  if (bounds) {
    const from = format(bounds.from, "yyyy-MM-dd");
    const to = format(bounds.to, "yyyy-MM-dd");
    sessionsQ = sessionsQ.gte("date", from).lte("date", to);
    checkinsQ = checkinsQ.gte("date", from).lte("date", to);
  }
  const [{ data: sessions, error }, { data: checkins, error: cErr }, { data: profile }] = await Promise.all([
    sessionsQ,
    checkinsQ,
    supabase.from("profiles").select("weight_kg").maybeSingle(),
  ]);
  if (error) throw error;
  if (cErr) throw cErr;

  // Fallback body weight for tibial-load scaling when a session lacks a snapshot.
  const latestWeight = [...((checkins ?? []) as { body_weight_kg: number | null }[])]
    .reverse()
    .find((c) => c.body_weight_kg != null)?.body_weight_kg;
  const fallbackBodyKg = latestWeight ?? profile?.weight_kg ?? null;

  const ids = (sessions ?? []).map((s) => s.id);
  const [{ data: sets }, { data: followups }] = await Promise.all([
    ids.length
      ? supabase.from("gym_sets").select("*").in("session_id", ids).order("position")
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase.from("rehab_followups").select("*").in("session_id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type GS = { session_id: string; exercise: string; sets: number | null; reps: number | null; weight: number | null; notes: string | null };
  type FU = { session_id: string; pain_score: number | null; rpe: number | null };
  type S = {
    id: string; date: string; type: string; duration_minutes: number | null; notes: string | null;
    rpe: number | null; running_minutes: number | null; surface: string | null; body_kg: number | null;
  };
  type CK = { date: string; soreness: number | null; notes: string | null };

  const setsBySession = new Map<string, GS[]>();
  ((sets ?? []) as GS[]).forEach((s) => {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  });
  const fuBySession = new Map<string, FU>();
  ((followups ?? []) as FU[]).forEach((f) => fuBySession.set(f.session_id, f));

  const rows: ExportRow[] = [];
  const blank = {
    exercise: "",
    sets: "",
    reps: "",
    weight: "",
    duration: "",
    tibial_load: "" as number | string,
    pain_score: "",
    rpe: "",
    daily_soreness: "",
  };

  for (const s of (sessions ?? []) as S[]) {
    const f = fuBySession.get(s.id);
    const load = computeSessionLoad({
      type: s.type,
      duration_minutes: s.duration_minutes,
      running_minutes: s.running_minutes,
      rpe: s.rpe ?? f?.rpe ?? null,
      surface: s.surface,
      body_kg: s.body_kg,
      fallbackBodyKg,
    });
    const fuFields = {
      pain_score: f?.pain_score ?? "",
      rpe: s.rpe ?? f?.rpe ?? "",
      tibial_load: load.tibial || "",
    };
    if (s.type === "gym") {
      const gs = setsBySession.get(s.id) ?? [];
      const used = gs.filter((g) => g.weight || g.sets || g.reps || g.notes);
      if (used.length === 0) {
        rows.push({
          ...blank,
          date: s.date,
          training_type: s.type,
          ...fuFields,
          notes: s.notes ?? "",
        });
      } else {
        for (const g of used) {
          rows.push({
            ...blank,
            date: s.date,
            training_type: s.type,
            exercise: g.exercise,
            sets: g.sets ?? "",
            reps: g.reps ?? "",
            weight: g.weight ?? "",
            ...fuFields,
            notes: g.notes ?? s.notes ?? "",
          });
        }
      }
    } else {
      rows.push({
        ...blank,
        date: s.date,
        training_type: s.type,
        duration: s.duration_minutes ?? "",
        ...fuFields,
        notes: s.notes ?? "",
      });
    }
  }

  for (const c of (checkins ?? []) as CK[]) {
    rows.push({
      ...blank,
      date: c.date,
      training_type: "checkin",
      daily_soreness: c.soreness ?? "",
      notes: c.notes ?? "",
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
