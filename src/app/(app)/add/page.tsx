import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Dumbbell, Bike, Footprints, Volleyball, ChevronLeft } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

const options = [
  { slug: "gym", href: "/add/gym", label: "Gym", Icon: Dumbbell },
  { slug: "cycling", href: "/add/cardio/cycling", label: "Cycling", Icon: Bike },
  { slug: "walking", href: "/add/cardio/walking", label: "Walking", Icon: Footprints },
  { slug: "football", href: "/add/cardio/football", label: "Football", Icon: Volleyball },
];

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

      <div className="grid grid-cols-2 gap-3">
        {options.map(({ href, label, Icon }) => (
          <Link key={href} href={`${href}${qs}`}>
            <Card className="aspect-square flex flex-col items-center justify-center gap-2">
              <Icon className="h-8 w-8" />
              <span className="font-medium">{label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
