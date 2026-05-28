import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand logo. Sourced from /public/logo.png.
 * Renders as a square; pass `size` for pixel dimensions.
 */
export function Logo({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Rehab Logger"
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain select-none", className)}
    />
  );
}
