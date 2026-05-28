"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/coach",      label: "Plan" },
  { href: "/coach/chat", label: "Chat" },
];

export function CoachTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex-1 text-center py-2 rounded-md transition-colors",
              active ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
