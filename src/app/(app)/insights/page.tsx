import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LineChart, BarChart, ComboChart } from "@/components/charts";
import { loadIntelligence } from "@/lib/load/aggregate";
import { tibialOf } from "@/lib/load/decision";
import { GREEN_PROGRESSION } from "@/lib/load/config";
import { format, parseISO, eachDayOfInterval, subDays } from "date-fns";

const TONE = {
  green: "#10b981",
  yellow: "#eab308",
  red: "#ef4444",
  ongoing: "#a1a1aa",
} as const;

export default async function InsightsPage() {
  const li = await loadIntelligence(60);
  const tShort = (d: string) => format(parseISO(d), "d/M");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: needEnrich, count: enrichCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact" })
    .neq("imported_from", "manual")
    .is("rpe", null)
    .order("date", { ascending: true })
    .limit(1);
  const enrichOldestId = needEnrich?.[0]?.id ?? null;

  const tenderDates = li.tendernessSeries.map((d) => tShort(d.date));
  const tenderLeft = li.tendernessSeries.map((d) => d.left);
  const tenderRight = li.tendernessSeries.map((d) => d.right);
  const hasTenderness = li.tendernessSeries.some((d) => d.left != null || d.right != null);

  // Load-vs-symptom: aligned by date over the last 28 days.
  const todayISO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
  const days = eachDayOfInterval({
    start: subDays(new Date(todayISO + "T00:00:00"), 27),
    end: new Date(todayISO + "T00:00:00"),
  }).map((d) => format(d, "yyyy-MM-dd"));
  const tibialByDate = new Map(li.dailyTibial.map((d) => [d.date, d.tibial]));
  const tenderByDate = new Map<string, number | null>(
    li.tendernessSeries.map((d) => [
      d.date,
      d.left == null && d.right == null ? null : Math.max(d.left ?? 0, d.right ?? 0),
    ]),
  );
  const combo = days.map((d) => ({
    label: tShort(d),
    load: tibialByDate.get(d) ?? 0,
    tenderness: tenderByDate.has(d) ? (tenderByDate.get(d) as number | null) : null,
  }));
  const hasLoad = li.dailyTibial.some((d) => d.tibial > 0);

  const lagFor = (type: string) =>
    [...li.recoveries]
      .filter((r) => r.type === type)
      .reverse()
      .map((r) => ({ label: tShort(r.date), value: r.daysUntilReady ?? 7, status: r.status }));
  const runLag = lagFor("running");
  const footballLag = lagFor("football");

  const weight = li.weightSeries.map((d) => d.kg);
  const weightDates = li.weightSeries.map((d) => tShort(d.date));

  const greenRun = li.recoveries.filter((r) => r.type === "running" && r.status === "green");
  const bestRun = greenRun.length ? Math.max(...greenRun.map((r) => r.tibial)) : null;
  const targetTibial = tibialOf(90, li.bodyKg, "asphalt");
  let projection: string | null = null;
  if (bestRun && bestRun > 0 && bestRun < targetTibial) {
    const weeks = Math.ceil(Math.log(targetTibial / bestRun) / Math.log(1 + GREEN_PROGRESSION));
    projection = `Vid +${Math.round(GREEN_PROGRESSION * 100)}%/vecka och grön respons är du runt 90 min sammanhängande löpning om ~${weeks} veckor (grov uppskattning, inte ett krav).`;
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Hem
      </Link>
      <h1 className="text-2xl font-semibold">Insikter</h1>

      {enrichCount && enrichCount > 0 && enrichOldestId && (
        <Link
          href={`/session/${enrichOldestId}/edit`}
          className="flex items-center justify-between rounded-2xl border border-yellow-500/40 bg-card px-4 py-3 text-sm"
        >
          <span>
            <span className="font-medium">{enrichCount} importerade pass</span> behöver RPE/underlag
          </span>
          <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
        </Link>
      )}

      <Card className="space-y-2">
        <h2 className="font-semibold">Lägesrapport</h2>
        <ul className="space-y-1.5 text-sm">
          {li.digest.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bästa tolererade löpdos" value={bestRun ? `${bestRun} AU` : "—"} />
        <Stat
          label="Impact denna vecka"
          value={`${li.runsThisWeek}`}
          sub={li.loadChangePct != null ? `${li.loadChangePct > 0 ? "+" : ""}${li.loadChangePct}% load vs förra v.` : undefined}
        />
      </div>

      {projection && (
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Uppbyggnad mot målet</p>
          <p className="text-sm">{projection}</p>
        </Card>
      )}

      <Section title="Load vs symptom (28 d)" hint="Tibial load (staplar) mot tryckömhet (linje). Leta efter ömhet som stiger 1–3 dagar efter en load-topp — mönstret före ett skov.">
        {hasLoad || hasTenderness ? (
          <ComboChart points={combo} />
        ) : (
          <Locked text="Logga ett löp-/fotbollspass och dina morgon-check-ins, så ritas load och ömhet här sida vid sida." />
        )}
      </Section>

      <Section title="Tryckömhet skenben (0–10)" hint="Vänster vs höger. Divergens föregår ofta ett skov.">
        {hasTenderness ? (
          <LineChart
            labels={tenderDates}
            series={[
              { label: "Vänster", color: "#3b82f6", values: tenderLeft },
              { label: "Höger", color: "#f97316", values: tenderRight },
            ]}
            min={0}
            max={10}
          />
        ) : (
          <Locked text="Gör några morgon-check-ins, så ser du ömhetstrenden för vänster och höger ben." />
        )}
      </Section>

      <Section title="Recovery lag — löpning" hint="Dagar tills skenbenen var redo igen efter ett löppass. Lägre = bättre. Färg = grön/gul/röd respons.">
        {runLag.length ? (
          <BarChart bars={runLag} unit=" d" colorFor={(b) => TONE[(b as { status?: keyof typeof TONE }).status ?? "ongoing"]} />
        ) : (
          <Locked text="Logga ett löppass och check-ins dagarna efter, så beräknas hur många dagar återhämtningen tog." />
        )}
      </Section>

      <Section
        title="Load Response"
        hint="Kroppens svar per löppass, normaliserat mot dosen. Frågan är inte 'gör det mer ont?' utan 'svarar kroppen värre än förväntat för belastningen?'."
      >
        {li.loadResponse.entries.length === 0 ? (
          <Locked text="Beräknas från ditt första löppass — jämför alltid mot föregående pass, aldrig mot vilodagar." />
        ) : (
          <div className="space-y-3">
            {li.loadResponse.latest && (
              <div className="rounded-lg bg-muted px-3 py-2.5 text-sm space-y-1">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Load</p>
                    <p className="font-medium">
                      {li.loadResponse.latest.loadDeltaPct != null
                        ? `${li.loadResponse.latest.loadDeltaPct > 0 ? "↑ +" : li.loadResponse.latest.loadDeltaPct < 0 ? "↓ " : "→ "}${li.loadResponse.latest.loadDeltaPct}%`
                        : "första"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ömhet</p>
                    <p className="font-medium">
                      {li.loadResponse.latest.tendernessDelta != null
                        ? li.loadResponse.latest.tendernessDelta === 0
                          ? "→ oförändrad"
                          : `${li.loadResponse.latest.tendernessDelta > 0 ? "↑ +" : "↓ "}${li.loadResponse.latest.tendernessDelta}`
                        : "–"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recovery lag</p>
                    <p className="font-medium">
                      {li.loadResponse.latest.lagDelta != null
                        ? li.loadResponse.latest.lagDelta === 0
                          ? "→ oförändrad"
                          : `${li.loadResponse.latest.lagDelta > 0 ? "↑ +" : "↓ "}${li.loadResponse.latest.lagDelta} d`
                        : "–"}
                    </p>
                  </div>
                </div>
                <p className="text-sm pt-1">{li.loadResponse.latest.interpretation}</p>
              </div>
            )}
            <div className="space-y-1.5">
              {li.loadResponse.entries.slice(0, 6).map((e) => (
                <div key={e.sessionId} className="text-sm flex items-baseline justify-between gap-2">
                  <span>
                    {tShort(e.date)} · {e.tibial} AU
                    {e.loadDeltaPct != null && (
                      <span className="text-muted-foreground"> ({e.loadDeltaPct > 0 ? "+" : ""}{e.loadDeltaPct}%)</span>
                    )}
                    {e.lag != null && <span className="text-muted-foreground"> · lag {e.lag} d</span>}
                  </span>
                  <span
                    className={
                      e.lri === "concerning"
                        ? "text-red-500"
                        : e.lri === "slightly_elevated"
                          ? "text-yellow-500"
                          : e.lri === "better_than_expected"
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                    }
                  >
                    {e.lri === "better_than_expected"
                      ? "Bättre än väntat"
                      : e.lri === "expected"
                        ? "Förväntad"
                        : e.lri === "slightly_elevated"
                          ? "Något förhöjd"
                          : "Avvikande"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Vad utlöser dina skov?" hint="Vilka pass föregick förhöjd reaktion — och om något stör attributionen.">
        {li.recoveries.length === 0 ? (
          <Locked text="Logga impact-pass och check-ins, så kopplar appen ihop skov med vad som föregick dem." />
        ) : (
          <div className="space-y-3">
            {li.triggers.findings.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {li.triggers.findings.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {li.triggers.flares.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                {li.triggers.flares.slice(0, 6).map((f, i) => (
                  <div key={i} className="text-sm flex items-baseline justify-between gap-2">
                    <span>
                      <span className="capitalize">{tShort(f.date)}</span> · {f.label}
                      {f.runningMinutes ? ` ${f.runningMinutes} min` : ""} · {f.surface}
                      {f.confounded && <span className="text-muted-foreground"> · osäker orsak</span>}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {f.daysUntilReady != null ? `${f.daysUntilReady} d` : "pågår"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {footballLag.length > 0 && (
        <Section title="Recovery lag — fotboll" hint="Fotboll är högst impact. Håll koll separat från löpningen.">
          <BarChart bars={footballLag} unit=" d" colorFor={(b) => TONE[(b as { status?: keyof typeof TONE }).status ?? "ongoing"]} />
        </Section>
      )}

      <Section title="Tibial load per dag (28 d)" hint="Benbelastningen från impact. Topparna är dina löp-/fotbollspass.">
        {hasLoad ? (
          <BarChart bars={li.dailyTibial.slice(-28).map((d) => ({ label: tShort(d.date), value: d.tibial }))} unit=" AU" />
        ) : (
          <Locked text="Inga impact-pass loggade än — den här fylls i när du börjat springa." />
        )}
      </Section>

      <Section title="Vikt (kg)" hint="Lägre kroppsmassa = lägre tibial load per km.">
        {weight.length > 1 ? (
          <LineChart labels={weightDates} series={[{ label: "Vikt", color: "#10b981", values: weight }]} unit="" />
        ) : (
          <Locked text="Fyll i vikt i check-in då och då, så ser du trenden här." />
        )}
      </Section>

      <p className="text-xs text-muted-foreground">
        Acute:chronic-kvoten visas medvetet inte under uppbyggnad — den blir missvisande vid låg volym.
        {li.acwr.ratio != null && ` (Nuvarande: ${li.acwr.ratio.toFixed(2)}.)`}
      </p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function Locked({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}
