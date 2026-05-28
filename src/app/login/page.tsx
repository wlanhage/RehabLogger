import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo size={96} priority />
          <h1 className="text-2xl font-semibold">Rehab Logger</h1>
          <p className="text-sm text-muted-foreground -mt-1">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
