"use server";
import { createClient } from "@/lib/supabase/server";
import { GYM_EXERCISES } from "@/lib/constants";
import { revalidatePath } from "next/cache";

function safeDate(raw: string | null | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
}

export async function createGymSession(rawDate?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const date = safeDate(rawDate);
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, type: "gym", date })
    .select()
    .single();
  if (error) throw error;

  const rows = GYM_EXERCISES.map((exercise, i) => ({
    session_id: session.id,
    user_id: user.id,
    position: i,
    exercise,
  }));
  const { error: setsErr } = await supabase.from("gym_sets").insert(rows);
  if (setsErr) throw setsErr;

  revalidatePath(`/calendar/${date}`);
  return { sessionId: session.id };
}

export async function saveGymSet(input: {
  id: string;
  set_format: string | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  notes: string | null;
}) {
  const supabase = await createClient();
  const { id, ...rest } = input;
  const hasData =
    rest.sets != null || rest.reps != null || rest.weight != null || (rest.notes ?? "") !== "";
  const { error } = await supabase
    .from("gym_sets")
    .update({ ...rest, skipped: hasData ? false : undefined })
    .eq("id", id);
  if (error) throw error;
}

export async function skipGymSet(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_sets")
    .update({
      skipped: true,
      sets: null,
      reps: null,
      weight: null,
      notes: null,
      set_format: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function finishSession(sessionId: string) {
  revalidatePath("/");
  revalidatePath("/calendar");
  return { sessionId };
}
