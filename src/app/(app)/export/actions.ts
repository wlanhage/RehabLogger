"use server";
import { createClient } from "@/lib/supabase/server";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export type ExportRow = {
  date: string;
  training_type: string;
  exercise: string;
  sets: number | string;
  reps: number | string;
  weight: number | string;
  duration: number | string;
  pain_score: number | string;
  pain_location: string;
  reaction: string;
  rpe: number | string;
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

  let q = supabase.from("sessions").select("*").order("date", { ascending: true });
  if (bounds) {
    q = q.gte("date", format(bounds.from, "yyyy-MM-dd")).lte("date", format(bounds.to, "yyyy-MM-dd"));
  }
  const { data: sessions, error } = await q;
  if (error) throw error;

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
  type FU = { session_id: string; pain_score: number | null; pain_location: string | null; reaction: string | null; rpe: number | null };
  type S = { id: string; date: string; type: string; duration_minutes: number | null; notes: string | null };

  const setsBySession = new Map<string, GS[]>();
  ((sets ?? []) as GS[]).forEach((s) => {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  });
  const fuBySession = new Map<string, FU>();
  ((followups ?? []) as FU[]).forEach((f) => fuBySession.set(f.session_id, f));

  const rows: ExportRow[] = [];
  for (const s of (sessions ?? []) as S[]) {
    const f = fuBySession.get(s.id);
    const fuFields = {
      pain_score: f?.pain_score ?? "",
      pain_location: f?.pain_location ?? "",
      reaction: f?.reaction ?? "",
      rpe: f?.rpe ?? "",
    };
    if (s.type === "gym") {
      const gs = setsBySession.get(s.id) ?? [];
      const used = gs.filter((g) => g.weight || g.sets || g.reps || g.notes);
      if (used.length === 0) {
        rows.push({
          date: s.date,
          training_type: s.type,
          exercise: "",
          sets: "",
          reps: "",
          weight: "",
          duration: "",
          ...fuFields,
          notes: s.notes ?? "",
        });
      } else {
        for (const g of used) {
          rows.push({
            date: s.date,
            training_type: s.type,
            exercise: g.exercise,
            sets: g.sets ?? "",
            reps: g.reps ?? "",
            weight: g.weight ?? "",
            duration: "",
            ...fuFields,
            notes: g.notes ?? s.notes ?? "",
          });
        }
      }
    } else {
      rows.push({
        date: s.date,
        training_type: s.type,
        exercise: "",
        sets: "",
        reps: "",
        weight: "",
        duration: s.duration_minutes ?? "",
        ...fuFields,
        notes: s.notes ?? "",
      });
    }
  }
  return rows;
}
