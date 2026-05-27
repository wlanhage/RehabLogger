"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAIN_LOCATIONS } from "@/lib/constants";
import { saveCheckin } from "./actions";
import type { DailyCheckin } from "@/types/db";

const NONE = "None / no soreness";

export function CheckinForm({ date, initial }: { date: string; initial: DailyCheckin | null }) {
  const [soreness, setSoreness] = useState<number>(initial?.soreness ?? 0);
  const [location, setLocation] = useState<string>(initial?.location ?? NONE);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  return (
    <form action={saveCheckin} className="space-y-6">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="soreness" value={soreness} />
      <input type="hidden" name="location" value={location === NONE ? "" : location} />
      <input type="hidden" name="notes" value={notes} />

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Soreness / sensitivity</Label>
          <span className="text-sm font-medium">{soreness}/10</span>
        </div>
        <Slider value={[soreness]} onValueChange={([v]) => setSoreness(v)} min={0} max={10} step={1} />
        <p className="text-xs text-muted-foreground">
          0 = completely fine. 5 = noticeable. 10 = severe pain even at rest.
        </p>
      </div>

      {soreness > 0 && (
        <div className="space-y-2">
          <Label>Where?</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{NONE}</SelectItem>
              {PAIN_LOCATIONS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Sleep, stress, soreness pattern (morning vs evening), anything that helped…"
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
