import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createCardioSession } from "./actions";
import { format, parseISO, isValid } from "date-fns";
import { getType, flowFor } from "@/lib/training-types";
import { IMPACT_ACTIVITIES } from "@/lib/load/config";

function safeDate(d?: string): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const parsed = parseISO(d);
  return isValid(parsed) ? d : new Date().toISOString().slice(0, 10);
}

export default async function CardioPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  const def = getType(type);
  if (!def || flowFor(type) !== "cardio") notFound();
  const date = safeDate(sp.date);
  const isImpact = (IMPACT_ACTIVITIES as readonly string[]).includes(type);
  const isRunning = type === "running";

  return (
    <form action={createCardioSession} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="date" value={date} />
      <div>
        <h1 className="text-2xl font-semibold">{def.label}</h1>
        <p className="text-sm text-muted-foreground">{format(parseISO(date), "EEEE, MMM d")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Total tid (minuter)</Label>
        <Input id="duration" name="duration" inputMode="numeric" required />
      </div>

      {isRunning && (
        <div className="space-y-2">
          <Label htmlFor="running_minutes">Varav joggminuter</Label>
          <Input id="running_minutes" name="running_minutes" inputMode="numeric" placeholder="t.ex. 12 vid run/walk" />
          <p className="text-xs text-muted-foreground">
            Vid run/walk: bara minuterna du faktiskt joggade. Det är de som belastar skenbenen.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="distance">Distans (km, valfritt)</Label>
        <Input id="distance" name="distance" inputMode="decimal" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rpe">Ansträngning (RPE 1–10)</Label>
        <Input id="rpe" name="rpe" inputMode="numeric" required />
      </div>

      {isImpact && (
        <div className="space-y-2">
          <Label htmlFor="surface">Underlag</Label>
          <select
            id="surface"
            name="surface"
            defaultValue=""
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

      <div className="space-y-2">
        <Label htmlFor="notes">Kommentar (valfritt)</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      <Button type="submit" size="lg" className="w-full">
        Spara & fortsätt
      </Button>
    </form>
  );
}
