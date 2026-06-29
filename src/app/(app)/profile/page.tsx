import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { ExportSection } from "./export-section";
import { PushNotifications } from "@/components/push-notifications";
import { signOut } from "@/app/login/actions";
import { Card } from "@/components/ui/card";
import type { Profile } from "@/types/db";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").maybeSingle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Profil</h1>
        <p className="text-sm text-muted-foreground">
          Kontexten din AI-coach läser vid varje förfrågan. Var specifik.
        </p>
      </header>

      <ProfileForm initial={(data as Profile | null) ?? null} />

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold">Notiser</h2>
        <Card>
          <PushNotifications />
        </Card>
      </section>

      <section className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold">Exportera data</h2>
        <Card>
          <ExportSection />
        </Card>
      </section>

      <section className="pt-2">
        <form action={signOut}>
          <button className="w-full text-sm text-muted-foreground py-3 rounded-lg border border-border">
            Logga ut
          </button>
        </form>
      </section>
    </div>
  );
}
