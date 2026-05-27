import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Dumbbell, Bike, Footprints, Volleyball } from "lucide-react";

const options = [
  { href: "/add/gym", label: "Gym", Icon: Dumbbell },
  { href: "/add/cardio/cycling", label: "Cycling", Icon: Bike },
  { href: "/add/cardio/walking", label: "Walking", Icon: Footprints },
  { href: "/add/cardio/football", label: "Football", Icon: Volleyball },
];

export default function AddPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Register training</h1>
      <div className="grid grid-cols-2 gap-3">
        {options.map(({ href, label, Icon }) => (
          <Link key={href} href={href}>
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
