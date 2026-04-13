import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* pt-14 on mobile to offset the sticky topbar height */}
      <div className="flex-1 overflow-x-hidden pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}
