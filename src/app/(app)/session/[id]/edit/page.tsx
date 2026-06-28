import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { labelFor, flowFor } from "@/lib/training-types";
import { IMPACT_ACTIVITIES } from "@/lib/load/config";
import { enrichSession } from "./actions";
import type { Session } from "@/types/db";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = data as Session;

  const isImpact = (IMPACT_ACTIVITIES as readonly string[]).includes(s.type);
  const isRunning = s.type === "running";

  // How many imported sessions still need data (incl. this one).
  const { count } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .neq("imported_from", "manual")
    .is("rpe", null);

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Hem
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Komplettera passet</h1>
        <p className="text-sm text-muted-foreground">
          {labelFor(s.type)} · {format(parseISO(s.date), "EEE d MMM")}
          {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
          {s.imported_from !== "manual" ? ` · från ${s.imported_from}` : ""}
        </p>
        {count && count > 1 ? (
          <p className="text-xs text-muted-foreground mt-1">{count} pass kvar att komplettera.</p>
        ) : null}
      </div>

      <form action={enrichSession} className="space-y-6">
        <input type="hidden" name="session_id" value={s.id} />

        <div className="space-y-2">
          <Label htmlFor="rpe">Ansträngning (RPE 1–10)</Label>
          <Input id="rpe" name="rpe" inputMode="numeric" defaultValue={s.rpe ?? ""} required />
        </div>

        {isRunning && (
          <div className="space-y-2">
            <Label htmlFor="running_minutes">Joggminuter (om run/walk)</Label>
            <Input
              id="running_minutes"
              name="running_minutes"
              inputMode="numeric"
              defaultValue={s.running_minutes ?? ""}
              placeholder={`lämna tomt = hela passet (${s.duration_minutes ?? "?"} min) räknas som löpning`}
            />
          </div>
        )}

        {isImpact && (
          <div className="space-y-2">
            <Label htmlFor="surface">Underlag</Label>
            <select
              id="surface"
              name="surface"
              defaultValue={s.surface ?? ""}
              className="flex h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Välj…</option>
              <option value="asphalt">Asfalt</option>
              <option value="treadmill">Löpband</option>
              <option value="gravel">Grus</option>
              <option value="grass">Gräs</option>
              <option value="mixed">Blandat</option>
            </select>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full">
          Spara{count && count > 1 ? " & nästa" : ""}
        </Button>
      </form>
    </div>
  );
}
