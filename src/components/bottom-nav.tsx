"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Calendar, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/",        label: "Home",     icon: Home       },
  { href: "/add",     label: "Add",      icon: PlusCircle },
  { href: "/calendar",label: "Calendar", icon: Calendar   },
  { href: "/coach",   label: "Coach",    icon: Sparkles   },
  { href: "/profile", label: "Profile",  icon: User       },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 max-w-md mx-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
