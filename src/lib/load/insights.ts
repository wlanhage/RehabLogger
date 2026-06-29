// Decision-support analysis (NOT planning): plain-language status, what likely
// triggered a flare, and whether today's reading is normal for this user.

import { IMPACT_ACTIVITIES } from "./config";
import { labelFor } from "@/lib/training-types";
import type { RecoveryResponse } from "./recovery";
import type { Session } from "@/types/db";

const SURFACE_LABEL: Record<string, string> = {
  asphalt: "asfalt",
  treadmill: "löpband",
  gravel: "grus",
  grass: "gräs",
  mixed: "blandat underlag",
};
const surfaceLabel = (s: string | null) => (s ? SURFACE_LABEL[s] ?? s : "okänt underlag");

const isFlare = (r: RecoveryResponse) => r.status === "red" || r.status === "yellow" || r.status === "ongoing";

// ---------- #2 Plain-language status report ----------------------------------

export function buildDigest(args: {
  tenderness: { date: string; left: number | null; right: number | null }[];
  recoveries: RecoveryResponse[];
  loadChangePct: number | null;
  runsThisWeek: number;
  baseline: number;
}): string[] {
  const { tenderness, recoveries, loadChangePct, runsThisWeek, baseline } = args;
  const out: string[] = [];

  const worse = tenderness
    .map((d) => (d.left == null && d.right == null ? null : Math.max(d.left ?? 0, d.right ?? 0)))
    .filter((v): v is number => v != null);

  // Trend: last 5 vs previous 5.
  if (worse.length >= 4) {
    const last = worse.slice(-5);
    const prev = worse.slice(-10, -5);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const lAvg = avg(last);
    const pAvg = prev.length ? avg(prev) : lAvg;
    const diff = lAvg - pAvg;
    if (diff <= -0.5) out.push(`Tryckömheten trendar nedåt (förbättras) — snitt ${lAvg.toFixed(1)} senaste dagarna mot ${pAvg.toFixed(1)} innan.`);
    else if (diff >= 0.5) out.push(`⚠️ Tryckömheten trendar uppåt — snitt ${lAvg.toFixed(1)} senaste dagarna mot ${pAvg.toFixed(1)} innan. Var försiktig.`);
    else out.push(`Tryckömheten är stabil (snitt ${lAvg.toFixed(1)}/10 senaste dagarna).`);
  } else if (worse.length > 0) {
    out.push(`För lite data för en trend än — fortsätt logga morgon-check-ins.`);
  }

  // Asymmetry over recent non-null readings.
  const recent = tenderness.slice(-14);
  const lVals = recent.map((d) => d.left).filter((v): v is number => v != null);
  const rVals = recent.map((d) => d.right).filter((v): v is number => v != null);
  if (lVals.length >= 3 && rVals.length >= 3) {
    const la = lVals.reduce((s, v) => s + v, 0) / lVals.length;
    const ra = rVals.reduce((s, v) => s + v, 0) / rVals.length;
    const d = la - ra;
    if (Math.abs(d) >= 1) {
      out.push(`${d > 0 ? "Vänster" : "Höger"} ben ligger i snitt ${Math.abs(d).toFixed(1)} högre än ${d > 0 ? "höger" : "vänster"} — håll koll på den sidan.`);
    }
  }

  // Last impact recovery.
  const lastRec = recoveries[0];
  if (lastRec) {
    if (lastRec.status === "ongoing") {
      out.push(`Senaste ${labelFor(lastRec.type).toLowerCase()}-passet har inte återhämtat sig än (toppömhet ${lastRec.peakTenderness ?? "?"}/10).`);
    } else {
      const word = lastRec.status === "green" ? "grönt" : lastRec.status === "yellow" ? "gult" : "rött";
      out.push(`Senaste ${labelFor(lastRec.type).toLowerCase()}-passet (${lastRec.tibial} AU) återhämtades på ${lastRec.daysUntilReady} dagar (${word}).`);
    }
  } else {
    out.push("Inga impact-pass loggade än — recovery-analysen startar när du springer.");
  }

  // Load + frequency context.
  if (loadChangePct != null) {
    out.push(`Tibial load denna vecka ${loadChangePct > 0 ? "+" : ""}${loadChangePct}% mot förra veckan (${runsThisWeek} impact-pass).`);
  }

  out.push(`Din baslinje för "återhämtad" är ${baseline}/10.`);
  return out;
}

// ---------- #1 What triggered the flares ------------------------------------

export type FlareTrigger = {
  date: string;
  type: string;
  label: string;
  tibial: number;
  surface: string;
  runningMinutes: number | null;
  daysUntilReady: number | null;
  status: RecoveryResponse["status"];
  confounded: boolean; // another impact session fell inside the recovery window
};

export type TriggerAnalysis = {
  flares: FlareTrigger[];
  surfaceBreakdown: { surface: string; flares: number; total: number }[];
  typeBreakdown: { type: string; flares: number; total: number }[];
  findings: string[]; // plain-language takeaways
};

export function analyzeTriggers(recoveries: RecoveryResponse[], sessions: Session[]): TriggerAnalysis {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const impact = sessions
    .filter((s) => (IMPACT_ACTIVITIES as readonly string[]).includes(s.type))
    .map((s) => ({ id: s.id, date: s.date }));

  const ms = (d: string) => new Date(d + "T00:00:00").getTime();
  const within = (a: string, b: string, days: number) => {
    const diff = (ms(b) - ms(a)) / 86_400_000;
    return diff > 0 && diff <= days;
  };

  const flares: FlareTrigger[] = recoveries
    .filter(isFlare)
    .map((r) => {
      const s = byId.get(r.sessionId);
      const confounded = impact.some((i) => i.id !== r.sessionId && within(r.date, i.date, 6));
      return {
        date: r.date,
        type: r.type,
        label: labelFor(r.type),
        tibial: r.tibial,
        surface: surfaceLabel(s?.surface ?? null),
        runningMinutes: s?.running_minutes ?? null,
        daysUntilReady: r.daysUntilReady,
        status: r.status,
        confounded,
      };
    });

  // Breakdown: flare rate per surface and per activity.
  const surfaceMap = new Map<string, { flares: number; total: number }>();
  const typeMap = new Map<string, { flares: number; total: number }>();
  for (const r of recoveries) {
    const s = byId.get(r.sessionId);
    const surf = surfaceLabel(s?.surface ?? null);
    const sm = surfaceMap.get(surf) ?? { flares: 0, total: 0 };
    sm.total++;
    if (isFlare(r)) sm.flares++;
    surfaceMap.set(surf, sm);

    const tm = typeMap.get(r.type) ?? { flares: 0, total: 0 };
    tm.total++;
    if (isFlare(r)) tm.flares++;
    typeMap.set(r.type, tm);
  }
  const surfaceBreakdown = [...surfaceMap.entries()]
    .map(([surface, v]) => ({ surface, ...v }))
    .sort((a, b) => b.total - a.total);
  const typeBreakdown = [...typeMap.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.total - a.total);

  // Plain-language findings.
  const findings: string[] = [];
  const worstSurface = surfaceBreakdown.filter((s) => s.total >= 2).sort((a, b) => b.flares / b.total - a.flares / a.total)[0];
  if (worstSurface && worstSurface.flares > 0) {
    findings.push(`${worstSurface.flares} av ${worstSurface.total} pass på ${worstSurface.surface} gav förhöjd reaktion.`);
  }
  const fb = typeBreakdown.find((t) => t.type === "football");
  if (fb && fb.flares > 0) {
    findings.push(`Fotboll: ${fb.flares} av ${fb.total} pass gav skov — högst impact, behandla försiktigt.`);
  }
  const confoundedCount = flares.filter((f) => f.confounded).length;
  if (confoundedCount > 0) {
    findings.push(`${confoundedCount} skov hade ett annat impact-pass inom återhämtningsfönstret — orsaken går inte att säkert särskilja. Variera en sak i taget.`);
  }
  if (flares.length === 0 && recoveries.length > 0) {
    findings.push("Inga skov hittills — dina loggade doser har tolererats väl.");
  }

  return { flares, surfaceBreakdown, typeBreakdown, findings };
}

// ---------- #3 Is today's reading normal for me? ----------------------------

export type TodayContext = {
  worse: number;
  baseline: number;
  recentAvg: number;
  level: "normal" | "slightly" | "elevated" | "high";
  text: string;
};

export function classifyToday(
  worse: number | null,
  baseline: number,
  recent: number[],
): TodayContext | null {
  if (worse == null) return null;
  const recentAvg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : baseline;

  let level: TodayContext["level"];
  if (worse <= baseline + 1) level = "normal";
  else if (worse <= Math.max(recentAvg + 1, 4) && worse <= 4) level = "slightly";
  else if (worse <= 6) level = "elevated";
  else level = "high";

  const labelMap = {
    normal: "i nivå med din normalnivå",
    slightly: "något förhöjt",
    elevated: "förhöjt",
    high: "kraftigt förhöjt",
  } as const;

  return {
    worse,
    baseline,
    recentAvg: Math.round(recentAvg * 10) / 10,
    level,
    text: `Dagens ömhet ${worse}/10 är ${labelMap[level]} (baslinje ${baseline}, snitt 14 d ${(Math.round(recentAvg * 10) / 10)}).`,
  };
}
