import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { Profile } from "@/types/db";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This is the context the AI coach reads on every request. Be specific — it will guide your weekly plans and chat advice.
      </p>
      <ProfileForm initial={(data as Profile | null) ?? null} />
    </div>
  );
}
