import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createCardioSession } from "./actions";

const labels: Record<string, string> = {
  cycling: "Cycling",
  walking: "Walking",
  football: "Football",
};

export default async function CardioPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!labels[type]) notFound();

  return (
    <form action={createCardioSession} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <h1 className="text-2xl font-semibold">{labels[type]}</h1>

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
