import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createCardioSession } from "./actions";
import { format, parseISO, isValid } from "date-fns";
import { getType, flowFor } from "@/lib/training-types";

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

  return (
    <form action={createCardioSession} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="date" value={date} />
      <div>
        <h1 className="text-2xl font-semibold">{def.label}</h1>
        <p className="text-sm text-muted-foreground">{format(parseISO(date), "EEEE, MMM d")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input id="duration" name="duration" inputMode="numeric" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="distance">Distance (km, optional)</Label>
        <Input id="distance" name="distance" inputMode="decimal" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      <Button type="submit" size="lg" className="w-full">
        Save & continue
      </Button>
    </form>
  );
}
