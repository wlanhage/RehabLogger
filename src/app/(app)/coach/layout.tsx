import { CoachTabs } from "./tabs";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">AI Coach</h1>
      <CoachTabs />
      <div>{children}</div>
    </div>
  );
}
