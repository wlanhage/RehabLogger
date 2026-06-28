import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LineChart, BarChart } from "@/components/charts";
import { loadIntelligence } from "@/lib/load/aggregate";
import { format, parseISO } from "date-fns";

const TONE = {
  green: "#10b981",
  yellow: "#eab308",
  red: "#ef4444",
  ongoing: "#a1a1aa",
} as const;

export default async function InsightsPage() {
  const li = await loadIntelligence(60);

  const tShort = (d: string) => format(parseISO(d), "d/M");

  // Tenderness L/R series.
  const tenderLeft = li.tendernessSeries.map((d) => d.left);
  const tenderRight = li.tendernessSeries.map((d) => d.right);

  // Daily tibial load bars (last 28 days).
  const loadBars = li.dailyTibial.slice(-28).map((d) => ({ label: tShort(d.date), value: d.tibial }));

  // Recovery lag per impact session (oldest → newest for reading left→right).
  const lagBars = [...li.recoveries]
    .reverse()
    .map((r) => ({ label: tShort(r.date), value: r.daysUntilReady ?? 7, status: r.status }));

  const weight = li.weightSeries.map((d) => d.kg);

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Hem
      </Link>
      <h1 className="text-2xl font-semibold">Insikter</h1>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Bästa tolererade löpdos"
          value={
            li.recoveries.some((r) => r.status === "green")
              ? `${Math.max(...li.recoveries.filter((r) => r.status === "green").map((r) => r.tibial))} AU`
              : "—"
          }
        />
        <Stat
          label="Impact denna vecka"
          value={`${li.runsThisWeek}`}
          sub={li.loadChangePct != null ? `${li.loadChangePct > 0 ? "+" : ""}${li.loadChangePct}% load vs förra v.` : undefined}
        />
      </div>

      <Section title="Tryckömhet skenben (0–10)" hint="Vänster vs höger över tid. Divergens föregår ofta ett skov.">
        <LineChart
          series={[
            { label: "Vänster", color: "#3b82f6", values: tenderLeft },
            { label: "Höger", color: "#f97316", values: tenderRight },
          ]}
          min={0}
          max={10}
        />
      </Section>

      <Section title="Recovery lag per impact-pass" hint="Dagar tills skenbenen var redo igen. Lägre = bättre. Färg = grön/gul/röd respons.">
        <BarChart
          bars={lagBars}
          unit=" d"
          colorFor={(b) => TONE[(b as { status?: keyof typeof TONE }).status ?? "ongoing"]}
        />
      </Section>

      <Section title="Tibial load per dag (28 d)" hint="Bensbelastningen från impact. Topparna är dina löp/fotbollspass.">
        <BarChart bars={loadBars} unit=" AU" />
      </Section>

      {weight.length > 1 && (
        <Section title="Vikt (kg)" hint="Lägre kroppsmassa = lägre tibial load per km.">
          <LineChart series={[{ label: "Vikt", color: "#10b981", values: weight }]} />
        </Section>
      )}

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}
