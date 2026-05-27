"use server";
import { createClient } from "@/lib/supabase/server";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export type ExportRow = {
  date: string;
  /** "gym" | "cycling" | "walking" | "football" | "checkin" */
  training_type: string;
  exercise: string;
  sets: number | string;
  reps: number | string;
  weight: number | string;
  duration: number | string;
  pain_score: number | string;
  pain_location: string;
  rpe: number | string;
  daily_soreness: number | string;
  daily_location: string;
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
  const [{ data: sessions, error }, { data: checkins, error: cErr }] = await Promise.all([sessionsQ, checkinsQ]);
  if (error) throw error;
  if (cErr) throw cErr;

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
  type FU = { session_id: string; pain_score: number | null; pain_location: string | null; rpe: number | null };
  type S = { id: string; date: string; type: string; duration_minutes: number | null; notes: string | null };
  type CK = { date: string; soreness: number | null; location: string | null; notes: string | null };

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
    pain_score: "",
    pain_location: "",
    rpe: "",
    daily_soreness: "",
    daily_location: "",
  } as const;

  for (const s of (sessions ?? []) as S[]) {
    const f = fuBySession.get(s.id);
    const fuFields = {
      pain_score: f?.pain_score ?? "",
      pain_location: f?.pain_location ?? "",
      rpe: f?.rpe ?? "",
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
      daily_location: c.location ?? "",
      notes: c.notes ?? "",
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
