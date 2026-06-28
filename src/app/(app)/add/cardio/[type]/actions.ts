"use server";
import { createClient } from "@/lib/supabase/server";
import { getType, flowFor } from "@/lib/training-types";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function safeDate(raw: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
}

export async function createCardioSession(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  if (!getType(type) || flowFor(type) !== "cardio") throw new Error("Invalid type");

  const numOrNull = (v: FormDataEntryValue | null) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const duration = numOrNull(formData.get("duration"));
  const distance = numOrNull(formData.get("distance"));
  const running_minutes = numOrNull(formData.get("running_minutes"));
  const rpe = numOrNull(formData.get("rpe"));
  const surfaceRaw = String(formData.get("surface") ?? "").trim();
  const surface = surfaceRaw || null;
  const notes = formData.get("notes");
  const date = safeDate(formData.get("date") ? String(formData.get("date")) : null);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Snapshot current body weight for accurate tibial-load scaling.
  const { data: latestWeight } = await supabase
    .from("daily_checkins")
    .select("body_weight_kg")
    .not("body_weight_kg", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("weight_kg").maybeSingle();
  const body_kg = latestWeight?.body_weight_kg ?? profile?.weight_kg ?? null;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      type,
      date,
      duration_minutes: duration,
      distance_km: distance,
      running_minutes,
      rpe,
      surface,
      body_kg,
      notes: notes ? String(notes) : null,
    })
    .select()
    .single();
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${date}`);
  redirect(`/follow-up/${data.id}`);
}
