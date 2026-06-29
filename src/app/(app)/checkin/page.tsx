import { createClient } from "@/lib/supabase/server";
import { CheckinForm } from "./checkin-form";
import { format, parseISO, isValid } from "date-fns";
import { sv } from "date-fns/locale";
import type { DailyCheckin } from "@/types/db";

function safeDate(d?: string): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const parsed = parseISO(d);
  return isValid(parsed) ? d : new Date().toISOString().slice(0, 10);
}

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = safeDate(sp.date);

  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Daglig check-in</h1>
        <p className="text-sm text-muted-foreground capitalize">
          {format(parseISO(date), "EEEE d MMM", { locale: sv })} — hur känns kroppen idag?
        </p>
      </header>
      <CheckinForm date={date} initial={(data as DailyCheckin | null) ?? null} />
    </div>
  );
}
