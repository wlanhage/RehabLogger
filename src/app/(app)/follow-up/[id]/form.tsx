"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAIN_LOCATIONS } from "@/lib/constants";
import { saveFollowup } from "./actions";

export function FollowupForm({ sessionId }: { sessionId: string }) {
  const [pain, setPain] = useState(0);
  const [rpe, setRpe] = useState(5);
  const [location, setLocation] = useState<string>(PAIN_LOCATIONS[0]);

  return (
    <form action={saveFollowup} className="space-y-6">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="pain_score" value={pain} />
      <input type="hidden" name="rpe" value={rpe} />
      <input type="hidden" name="pain_location" value={location} />

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Pain / discomfort right now</Label>
          <span className="text-sm font-medium">{pain}/10</span>
        </div>
        <Slider value={[pain]} onValueChange={([v]) => setPain(v)} min={0} max={10} step={1} />
      </div>

      <div className="space-y-2">
        <Label>Pain location</Label>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAIN_LOCATIONS.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>RPE (effort)</Label>
          <span className="text-sm font-medium">{rpe}/10</span>
        </div>
        <Slider value={[rpe]} onValueChange={([v]) => setRpe(v)} min={1} max={10} step={1} />
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: log a daily check-in tomorrow morning to capture how your body reacts in the days that follow.
      </p>

      <Button type="submit" size="lg" className="w-full">Save</Button>
    </form>
  );
}
