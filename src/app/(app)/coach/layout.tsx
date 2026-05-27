import Link from "next/link";
import { CoachTabs } from "./tabs";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">AI Coach</h1>
        <Link href="/coach/profile" className="text-xs text-muted-foreground underline">
          Edit profile
        </Link>
      </div>
      <CoachTabs />
      <div>{children}</div>
    </div>
  );
}
