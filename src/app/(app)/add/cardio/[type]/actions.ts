"use server";
import { createClient } from "@/lib/supabase/server";
import { TRAINING_TYPES, type TrainingType } from "@/lib/constants";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createCardioSession(formData: FormData) {
  const type = String(formData.get("type") ?? "") as TrainingType;
  if (!TRAINING_TYPES.includes(type) || type === "gym") throw new Error("Invalid type");

  const duration = formData.get("duration");
  const distance = formData.get("distance");
  const notes = formData.get("notes");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      type,
      date: today,
      duration_minutes: duration ? Number(duration) : null,
      distance_km: distance ? Number(distance) : null,
      notes: notes ? String(notes) : null,
    })
    .select()
    .single();
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/calendar");
  redirect(`/follow-up/${data.id}`);
}
