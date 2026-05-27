"use server";
import { createClient } from "@/lib/supabase/server";
import { chatComplete } from "@/lib/ai/openrouter";
import {
  COACH_SYSTEM_PROMPT,
  formatContextForPrompt,
  loadCoachContext,
} from "@/lib/ai/context";
import { format, startOfWeek } from "date-fns";
import { revalidatePath } from "next/cache";

export async function generateWeeklyPlan() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ctx = await loadCoachContext(14);
  const contextBlock = formatContextForPrompt(ctx);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const userPrompt = `It's the start of a new training week (week of ${weekStart}).

Based on the user's profile and the last two weeks of training and rehab follow-ups below, produce a concrete 7-day plan (Mon–Sun) for THIS week.

Rules for the plan:
- Match volume and intensity to the recent load and symptom trend. If pain or reactions trended up, deload.
- Each day must include: intent (e.g. lower-leg strength, easy aerobic, mobility, rest), session type (gym / cycling / walking / football / rest), intensity guidance (RPE target or pace cue), and a brief "watch for" note tied to the user's rehab focus.
- Include at least one full rest or active-recovery day.
- Reference the user's profile and recent sessions explicitly where relevant.
- Keep it tight: under ~400 words.

CONTEXT
---
${contextBlock}
---`;

  const content = await chatComplete(
    [
      { role: "system", content: COACH_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.4 },
  );

  const { error } = await supabase.from("weekly_plans").upsert(
    { user_id: user.id, week_start: weekStart, content },
    { onConflict: "user_id,week_start" },
  );
  if (error) throw error;

  revalidatePath("/coach");
  return { content, week_start: weekStart };
}
