"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function saveFollowup(formData: FormData) {
  const session_id = String(formData.get("session_id"));
  const pain_score = Number(formData.get("pain_score") ?? 0);
  const pain_location = String(formData.get("pain_location") ?? "");
  const rpe = Number(formData.get("rpe") ?? 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Verify the session belongs to this user (RLS makes this a no-op for foreign sessions).
  const { data: owned, error: ownErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", session_id)
    .maybeSingle();
  if (ownErr) throw ownErr;
  if (!owned) throw new Error("Session not found");

  const { error } = await supabase.from("rehab_followups").upsert(
    {
      session_id,
      user_id: user.id,
      pain_score,
      pain_location,
      reaction: null,
      rpe,
    },
    { onConflict: "session_id" },
  );
  if (error) throw error;

  revalidatePath("/");
  revalidatePath("/calendar");
  redirect("/");
}
