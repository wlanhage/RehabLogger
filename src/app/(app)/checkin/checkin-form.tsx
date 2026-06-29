"use client";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveCheckin } from "./actions";
import type { DailyCheckin } from "@/types/db";

const SAFE_OPTIONS = [
  { value: "yes", label: "Ja" },
  { value: "unsure", label: "Osäker" },
  { value: "no", label: "Nej" },
] as const;

export function CheckinForm({ date, initial }: { date: string; initial: DailyCheckin | null }) {
  const [left, setLeft] = useState<number>(initial?.shin_tenderness_left ?? 0);
  const [right, setRight] = useState<number>(initial?.shin_tenderness_right ?? 0);
  const [safe, setSafe] = useState<string>(initial?.safe_to_run ?? "");
  const [sleep, setSleep] = useState<number>(initial?.sleep_quality ?? 7);
  const [fatigue, setFatigue] = useState<number>(initial?.general_fatigue ?? 5);
  const [weight, setWeight] = useState<string>(initial?.body_weight_kg?.toString() ?? "");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  return (
    <form action={saveCheckin} className="space-y-6">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shin_left" value={left} />
      <input type="hidden" name="shin_right" value={right} />
      <input type="hidden" name="safe_to_run" value={safe} />
      <input type="hidden" name="sleep_quality" value={sleep} />
      <input type="hidden" name="general_fatigue" value={fatigue} />
      <input type="hidden" name="body_weight_kg" value={weight} />
      <input type="hidden" name="notes" value={notes} />

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Tryckömhet vänster benhinna</Label>
          <span className="text-sm font-medium">{left}/10</span>
        </div>
        <Slider value={[left]} onValueChange={([v]) => setLeft(v)} min={0} max={10} step={1} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Tryckömhet höger benhinna</Label>
          <span className="text-sm font-medium">{right}/10</span>
        </div>
        <Slider value={[right]} onValueChange={([v]) => setRight(v)} min={0} max={10} step={1} />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Tryck längs skenbenskanten. 0 = ingen ömhet, 10 = mycket öm/svår.
      </p>

      <div className="space-y-2">
        <Label>Känns det säkert att springa idag?</Label>
        <div className="grid grid-cols-3 gap-2">
          {SAFE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setSafe(o.value)}
              className={cn(
                "rounded-lg border py-3 text-sm font-medium transition-colors",
                safe === o.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Sömnkvalitet</Label>
          <span className="text-sm font-medium">{sleep}/10</span>
        </div>
        <Slider value={[sleep]} onValueChange={([v]) => setSleep(v)} min={1} max={10} step={1} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Trötthet / allmän belastning</Label>
          <span className="text-sm font-medium">{fatigue}/10</span>
        </div>
        <Slider value={[fatigue]} onValueChange={([v]) => setFatigue(v)} min={1} max={10} step={1} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="weight">Vikt (kg)</Label>
        <Input
          id="weight"
          inputMode="decimal"
          placeholder="valfritt"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Kommentar</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Var känns det? Hur kändes gårdagens pass i efterhand? Stress, stelhet, annat?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <SubmitButton size="lg" className="w-full" pendingText="Sparar…">
        {initial ? "Uppdatera check-in" : "Spara check-in"}
      </SubmitButton>
    </form>
  );
}
