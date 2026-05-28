import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getType, DEFAULT_ENABLED } from "@/lib/training-types";

function safeDate(d?: string): string | null {
  if (!d) return null;
  const parsed = parseISO(d);
  return isValid(parsed) ? d : null;
}

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = safeDate(sp.date);
  const qs = date ? `?date=${date}` : "";

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("training_types").maybeSingle();
  const enabled = (profile?.training_types as string[] | null) ?? DEFAULT_ENABLED;

  const options = enabled
    .map((slug) => getType(slug))
    .filter((t): t is NonNullable<ReturnType<typeof getType>> => Boolean(t))
    .map((t) => {
      const href = t.flow === "gym" ? `/add/gym` : `/add/cardio/${t.slug}`;
      return { ...t, href };
    });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {date && (
          <Link href={`/calendar/${date}`} className="inline-flex items-center text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        )}
        <h1 className="text-2xl font-semibold">Register training</h1>
        <p className="text-sm text-muted-foreground">
          {date ? `Logging for ${format(parseISO(date), "EEEE, MMM d")}` : "Logging for today"}
        </p>
      </div>

      {options.length === 0 ? (
        <Card>
          <p className="text-sm">
            You haven&apos;t picked any activities yet. Head to{" "}
            <Link href="/profile" className="underline">Profile</Link> and choose what you train.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {options.map(({ slug, label, icon: Icon, href }) => (
            <Link key={slug} href={`${href}${qs}`}>
              <Card className="aspect-square flex flex-col items-center justify-center gap-2 text-center">
                <Icon className="h-8 w-8" />
                <span className="font-medium text-sm">{label}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
