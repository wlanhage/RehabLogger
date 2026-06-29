import { cn } from "@/lib/utils";

/**
 * Brand mark — a recovery curve (dip → return) in an emerald→sky gradient.
 * Inline SVG so it stays crisp and theme-friendly on the dark UI.
 */
export function Logo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
  /** Accepted for API compatibility; unused (inline SVG needs no priority). */
  priority?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("select-none shrink-0", className)}
      role="img"
      aria-label="Rehab Logger"
    >
      <defs>
        <linearGradient id="rl-mark" x1="10" y1="86" x2="86" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path
        d="M12 46 C 28 46, 33 68, 48 68 C 63 68, 68 30, 82 28"
        stroke="url(#rl-mark)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="82" cy="28" r="8.5" fill="#38bdf8" />
    </svg>
  );
}
