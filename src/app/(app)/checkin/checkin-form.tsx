"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { saveCheckin } from "./actions";
import type { DailyCheckin } from "@/types/db";

export function CheckinForm({ date, initial }: { date: string; initial: DailyCheckin | null }) {
  const [soreness, setSoreness] = useState<number>(initial?.soreness ?? 0);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  return (
    <form action={saveCheckin} className="space-y-6">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="soreness" value={soreness} />
      <input type="hidden" name="notes" value={notes} />

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>How does your body feel?</Label>
          <span className="text-sm font-medium">{soreness}/10</span>
        </div>
        <Slider value={[soreness]} onValueChange={([v]) => setSoreness(v)} min={0} max={10} step={1} />
        <p className="text-xs text-muted-foreground">
          0 = fresh, no soreness. 5 = noticeable. 10 = severe pain even at rest.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={4}
          placeholder="What feels tight, sore, or off? How was sleep? Anything the coach should know — pain pattern (morning vs evening), stress, recovery, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full">
        {initial ? "Update check-in" : "Save check-in"}
      </Button>
    </form>
  );
}
