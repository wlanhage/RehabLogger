"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function saveFollowup(formData: FormData) {
  const session_id = String(formData.get("session_id"));

  const numOrNull = (v: FormDataEntryValue | null) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const left = numOrNull(formData.get("shin_left"));
  const right = numOrNull(formData.get("shin_right"));
  // RPE only comes from the follow-up for sessions that didn't capture it
  // on their own form (gym). Cardio already stored it on the session.
  const rpe = numOrNull(formData.get("rpe"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Verify the session belongs to this user (RLS makes this a no-op for foreign sessions).
  const { data: owned, error: ownErr } = await supabase
    .from("sessions")
    .select("id, rpe")
    .eq("id", session_id)
    .maybeSingle();
  if (ownErr) throw ownErr;
  if (!owned) throw new Error("Session not found");

  const { error } = await supabase.from("rehab_followups").upsert(
    {
      session_id,
      user_id: user.id,
      // Mirror worse shin into legacy pain_score so old views keep working.
      pain_score: Math.max(left ?? 0, right ?? 0),
      pain_location: null,
      reaction: null,
      shin_tenderness_left: left,
      shin_tenderness_right: right,
      rpe: rpe ?? null,
    },
    { onConflict: "session_id" },
  );
  if (error) throw error;

  // Backfill session RPE if it wasn't captured on the session's own form.
  if (rpe != null && owned.rpe == null) {
    await supabase.from("sessions").update({ rpe }).eq("id", session_id);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  redirect("/");
}
