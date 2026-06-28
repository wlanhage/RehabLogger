"use server";
import { createClient } from "@/lib/supabase/server";
import { chatComplete } from "@/lib/ai/gemini";
import {
  COACH_SYSTEM_PROMPT,
  formatContextForPrompt,
  loadCoachContext,
} from "@/lib/ai/context";
import { isWeeklyPlanDoc } from "@/lib/ai/plan-schema";
import { loadIntelligence, formatLoadForPrompt } from "@/lib/load/aggregate";
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
  const li = await loadIntelligence();
  const contextBlock = `${formatContextForPrompt(ctx)}\n\nLOAD INTELLIGENCE\n${formatLoadForPrompt(li)}`;
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = format(monday, "yyyy-MM-dd");

  const dayList = WEEKDAYS_SV.map((wd, i) => {
    const d = addDays(monday, i);
    return `  - ${wd} ${format(d, "yyyy-MM-dd")}`;
  }).join("\n");

  const userPrompt = `Det är början på en ny träningsvecka (vecka som startar ${weekStart}).

Generera en konkret 7-dagars plan (Mån–Sön) för DENNA vecka.

KRITISKT — KONTEXT-HANTERING
- Din ENDA datakälla är RECENT SESSIONS, DAILY CHECK-INS och GYM PROGRESSION i kontexten. Det är vad användaren FAKTISKT har gjort och känt.
- Eventuella tidigare veckoplaner är INTE en datakälla. Användaren kan ha skippat hela pass eller övningar. Lita aldrig på vad som var planerat — bara på vad som loggats.
- Planen är FRAMÅTBLICKANDE. Sammanfatta inte vad som hände förra veckan i löpande text — använd den datan tyst som grund för dina rekommendationer.
- Om en övning saknas i GYM PROGRESSION för en längre period: behandla den som obekant, börja konservativt.
- Om symptom (smärta/ömhet) trendar upp i check-ins → deload denna vecka.
- Om träningsfrekvens varit låg → trappa upp långsamt, inte rakt tillbaka till föregående volym.

REGLER FÖR PLANEN
- Inkludera minst en helt vilodag eller aktiv återhämtningsdag.
- Konservativ progression baserat på faktisk loggad data.
- Hänvisa till specifika loggade pass eller faktiska vikter där det är relevant ("baserat på din 3×10 @22.5kg på Bulgarian Split Squat förra veckan…").

GYM-DAGAR
- För varje "session_type": "gym" MÅSTE "exercises"-arrayen ha 3–6 konkreta övningar.
- Välj ENDAST från AVAILABLE GYM EXERCISES-listan.
- Sätt "sets", "reps" och "weight" baserat på SENASTE FAKTISKT LOGGADE värdet i GYM PROGRESSION. Standardprogression: +2,5–5 kg om reaktionen var bra; håll eller backa om ömhet trendar upp.
- Om en övning aldrig loggats: starta på en konservativ vikt och markera i "notes" att det är start-vikt.
- "weight" är en sträng — t.ex. "60kg", "bodyweight", "55→60kg".

SUMMARY-FÄLTET
- MAX 2 meningar. Veckans STRATEGI — inte recap av förra veckan.
- Exempel på BRA summary: "Konservativ progression på underbensarbete; en extra vilodag eftersom ömheten trendat upp."
- Exempel på DÅLIG summary: "Förra veckan tränade du fotboll på tisdag och gym på torsdag. Du hade ömhet som sjönk från 6/10 till 1/10. Denna vecka…" — det är retrospektion, inte strategi.

KEY_FOCUS
- MAX 1 mening. Headline för veckan.

UTDATAFORMAT
Svara med ENDAST giltig JSON (inga code-fences, ingen extra text):

{
  "week_start": "${weekStart}",
  "summary": "Max 2 meningar — veckans framåtblickande strategi.",
  "key_focus": "1 mening — veckans headline.",
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
    // thinkingBudget: 0 disables Gemini 2.5's internal reasoning so the full
    // output budget goes to the JSON response. Without this the plan gets
    // truncated mid-document when reasoning eats most of maxOutputTokens.
    { temperature: 0.4, maxTokens: 4000, json: true, thinkingBudget: 0 },
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
