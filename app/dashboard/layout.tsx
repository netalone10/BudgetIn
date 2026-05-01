import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="relative flex-1 overflow-x-hidden pt-14 md:pt-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[linear-gradient(180deg,rgba(24,226,153,0.08),rgba(24,226,153,0))]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-border/60" />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}
