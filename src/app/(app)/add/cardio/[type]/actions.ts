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

  const duration = formData.get("duration");
  const distance = formData.get("distance");
  const notes = formData.get("notes");
  const date = safeDate(formData.get("date") ? String(formData.get("date")) : null);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      type,
      date,
      duration_minutes: duration ? Number(duration) : null,
      distance_km: distance ? Number(distance) : null,
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
