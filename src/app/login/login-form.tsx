"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = mode === "signin" ? await signIn(fd) : await signUp(fd);
      if (res?.error) setError(res.error);
      if (res?.info) setInfo(res.info);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Lösenord</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {info && <p className="text-sm text-muted-foreground">{info}</p>}
      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "..." : mode === "signin" ? "Logga in" : "Skapa konto"}
      </Button>
      <button
        type="button"
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        className="w-full text-sm text-muted-foreground"
      >
        {mode === "signin" ? "Behöver du ett konto? Registrera dig" : "Har du ett konto? Logga in"}
      </button>
    </form>
  );
}
