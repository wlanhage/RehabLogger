"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthResult = { error: string | null; info?: string };

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // If Supabase email confirmation is disabled, signUp returns a session
  // directly and the user is already logged in — go straight to home.
  if (data.session) redirect("/");

  // Otherwise: try to sign in immediately. If confirmation IS required,
  // this will fail with "Email not confirmed" and we surface that clearly.
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (!signInErr) redirect("/");

  return {
    error: null,
    info:
      "Account created. Confirm your email (check inbox) or disable email confirmation in your Supabase dashboard under Authentication → Sign In / Up → Email.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
