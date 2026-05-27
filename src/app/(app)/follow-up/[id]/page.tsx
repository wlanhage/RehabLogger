import { FollowupForm } from "./form";

export default async function FollowupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">How did it feel?</h1>
        <p className="text-sm text-muted-foreground">Quick rehab check-in.</p>
      </header>
      <FollowupForm sessionId={id} />
    </div>
  );
}
