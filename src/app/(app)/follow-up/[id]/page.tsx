import { createClient } from "@/lib/supabase/server";
import { FollowupForm } from "./form";

export default async function FollowupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("rpe")
    .eq("id", id)
    .maybeSingle();

  // Only ask RPE here if the session didn't capture it on its own form (gym).
  const needsRpe = session ? session.rpe == null : true;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Hur känns det nu?</h1>
        <p className="text-sm text-muted-foreground">
          Kvällsömhet i skenbenen — det är reaktionen efter passet som styr motorn.
        </p>
      </header>
      <FollowupForm sessionId={id} needsRpe={needsRpe} />
    </div>
  );
}
