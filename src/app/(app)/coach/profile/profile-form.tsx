"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile } from "@/types/db";
import { saveProfile } from "./actions";

export function ProfileForm({ initial }: { initial: Profile | null }) {
  const [sex, setSex] = useState<string>(initial?.sex ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("sex", sex);
    start(async () => {
      try {
        await saveProfile(fd);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Name</Label>
        <Input id="display_name" name="display_name" defaultValue={initial?.display_name ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Sex</Label>
          <Select value={sex} onValueChange={setSex}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input id="age" name="age" inputMode="numeric" defaultValue={initial?.age ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="weight_kg">Weight (kg)</Label>
          <Input id="weight_kg" name="weight_kg" inputMode="decimal" defaultValue={initial?.weight_kg ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height_cm">Height (cm)</Label>
          <Input id="height_cm" name="height_cm" inputMode="numeric" defaultValue={initial?.height_cm ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rehab_focus">Rehab focus</Label>
        <Textarea
          id="rehab_focus"
          name="rehab_focus"
          rows={3}
          placeholder="e.g. Shin splints (medial tibial stress syndrome) both legs, worse on the left. Started ~6 months ago after ramping up running volume too fast."
          defaultValue={initial?.rehab_focus ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goals">Goals</Label>
        <Textarea
          id="goals"
          name="goals"
          rows={2}
          placeholder="e.g. Return to 4×/week running, play football pain-free, half marathon in 8 months."
          defaultValue={initial?.goals ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes for the coach</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Anything else the AI should know — past injuries, sleep, time constraints, gym access, etc."
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-muted-foreground">Saved.</p>}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
