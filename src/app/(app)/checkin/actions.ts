"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function safeDate(raw: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!raw) return today;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
}

export async function saveCheckin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const date = safeDate(formData.get("date") ? String(formData.get("date")) : null);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const numOrNull = (v: FormDataEntryValue | null) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const left = numOrNull(formData.get("shin_left"));
  const right = numOrNull(formData.get("shin_right"));
  const safeRaw = String(formData.get("safe_to_run") ?? "");
  const safe_to_run = ["yes", "unsure", "no"].includes(safeRaw) ? safeRaw : null;
  const sleep = numOrNull(formData.get("sleep_quality"));
  const weight = numOrNull(formData.get("body_weight_kg"));

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      date,
      // Keep general soreness in sync with the worse shin for legacy views.
      soreness: Math.max(left ?? 0, right ?? 0),
      location: null,
      shin_tenderness_left: left,
      shin_tenderness_right: right,
      safe_to_run,
      sleep_quality: sleep,
      body_weight_kg: weight,
      notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${date}`);
  revalidatePath("/checkin");
  redirect("/");
}
