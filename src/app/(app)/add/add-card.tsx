"use client";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { iconFor } from "@/lib/training-types";

function Inner({ slug, label }: { slug: string; label: string }) {
  const { pending } = useLinkStatus();
  const Icon = iconFor(slug);
  return (
    <Card className="aspect-square flex flex-col items-center justify-center gap-2 text-center">
      {pending ? <Loader2 className="h-8 w-8 animate-spin" /> : <Icon className="h-8 w-8" />}
      <span className="font-medium text-sm">{pending ? "Öppnar…" : label}</span>
    </Card>
  );
}

export function AddCard({ href, slug, label }: { href: string; slug: string; label: string }) {
  return (
    <Link href={href}>
      <Inner slug={slug} label={label} />
    </Link>
  );
}
