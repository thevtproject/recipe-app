import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { TimerProvider } from "@/components/timer/TimerProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = (session.user as any).role === "ADMIN";

  return (
    <TimerProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
          <div className="flex items-center h-16 px-6 border-b border-border">
            <span className="text-lg font-semibold tracking-wide">🍽 Recipe Book</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav isAdmin={isAdmin} />
          </div>
        </div>

        {/* Main content */}
        <div className="md:pl-64">
          {/* Top header with user menu (avatar + dropdown: Profile, Household, [Admin], Logout) */}
          <header className="sticky top-0 z-40 flex items-center justify-end h-14 px-4 md:px-6 bg-background/80 backdrop-blur border-b border-border">
            <UserMenu isAdmin={isAdmin} />
          </header>
          <main className="p-6 pb-24 md:pb-6">{children}</main>
        </div>

        {/* Mobile bottom nav */}
        <BottomNav isAdmin={isAdmin} />
      </div>
    </TimerProvider>
  );
}
