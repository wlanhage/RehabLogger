import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-6 pb-24">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
