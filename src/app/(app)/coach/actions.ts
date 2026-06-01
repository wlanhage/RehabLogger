"use server";
import { createClient } from "@/lib/supabase/server";
import { chatComplete } from "@/lib/ai/openrouter";
import {
  COACH_SYSTEM_PROMPT,
  formatContextForPrompt,
  loadCoachContext,
} from "@/lib/ai/context";
import { isWeeklyPlanDoc } from "@/lib/ai/plan-schema";
import { addDays, format, startOfWeek } from "date-fns";
import { revalidatePath } from "next/cache";

const WEEKDAYS_SV = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export async function generateWeeklyPlan() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ctx = await loadCoachContext(14);
  const contextBlock = formatContextForPrompt(ctx);
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = format(monday, "yyyy-MM-dd");

  const dayList = WEEKDAYS_SV.map((wd, i) => {
    const d = addDays(monday, i);
    return `  - ${wd} ${format(d, "yyyy-MM-dd")}`;
  }).join("\n");

  const userPrompt = `Det är början på en ny träningsvecka (vecka som startar ${weekStart}).

Baserat på användarens profil och de senaste två veckorna av träning, dagliga check-ins och rehab-data nedan — generera en konkret 7-dagars plan (Mån–Sön) för DENNA vecka.

REGLER FÖR PLANEN
- Anpassa volym och intensitet efter senaste load och symptomtrend. Om smärta eller ömhet trendar upp → deload.
- Inkludera minst en helt vilodag eller aktiv återhämtningsdag.
- Hänvisa till specifika pass, check-ins eller GYM PROGRESSION i kontexten där det är relevant.
- Konservativ progression.

GYM-DAGAR — VIKTIGT
- För varje dag med "session_type": "gym" MÅSTE du fylla i "exercises"-arrayen med 3–6 konkreta övningar.
- Välj ENDAST från AVAILABLE GYM EXERCISES-listan i kontexten (användaren kan bara logga dessa).
- Sätt "sets", "reps" och "weight" baserat på GYM PROGRESSION-historiken. Standardprogression: +2,5–5 kg från senaste värdet om reaktionen var bra; håll eller backa om ömhet/smärta trendar upp.
- "weight" är en sträng — använd t.ex. "60kg", "bodyweight", eller "55→60kg" för progression inom passet.
- "notes" får innehålla tempo, fokus eller cue (t.ex. "tempo 3-1-1", "kontrollerad excentrisk").

UTDATAFORMAT
Svara med ENDAST giltig JSON som följer detta schema (inga code-fences, ingen extra text):

{
  "week_start": "${weekStart}",
  "summary": "1–3 meningar: snabb load-analys + veckans strategi.",
  "key_focus": "Kort headline-takeaway, max 1 mening.",
  "days": [
${dayList.split("\n").map((l) => {
  const [, wd, date] = l.trim().split(/\s+/);
  return `    {
      "date": "${date}",
      "weekday": "${wd}",
      "completed": false,
      "intent": "kort syfte, t.ex. 'Aktiv återhämtning + underbensförberedelse'",
      "session_type": "gym|cycling|walking|football|rest|other",
      "duration": "t.ex. '30–40 min' eller utelämna för rest",
      "intensity": "t.ex. 'RPE 4–5/10' eller 'samtalstempo'",
      "focus": "kort sammanfattning av passets karaktär",
      "watch_for": "symptomkoppling: vad ska du känna efter / akta dig för",
      "exercises": [
        { "exercise": "Standing Calf Raise", "sets": 3, "reps": 12, "weight": "40kg", "notes": "tempo 3-1-1" }
      ]
    }`;
}).join(",\n")}
  ]
}

Använd EXAKT dessa 7 datum i ordning. Sätt "completed": true för dagar som redan har en loggad session i kontexten. Lämna "exercises" som tom array [] för icke-gym-dagar.

KONTEXT
---
${contextBlock}
---`;

  const raw = await chatComplete(
    [
      { role: "system", content: COACH_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.4, maxTokens: 1500, json: true },
  );

  // Validate before saving — if parsing fails, save raw text and let UI fall back.
  let toStore = raw.trim();
  try {
    const parsed = JSON.parse(toStore);
    if (!isWeeklyPlanDoc(parsed)) throw new Error("schema mismatch");
    // Force the week_start to be correct (model sometimes drifts).
    parsed.week_start = weekStart;
    toStore = JSON.stringify(parsed);
  } catch {
    // Keep raw — UI will render as <pre>.
  }

  const { error } = await supabase.from("weekly_plans").upsert(
    { user_id: user.id, week_start: weekStart, content: toStore },
    { onConflict: "user_id,week_start" },
  );
  if (error) throw error;

  revalidatePath("/coach");
  return { content: toStore, week_start: weekStart };
}
