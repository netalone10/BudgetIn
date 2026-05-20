import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side guard: non-admin (atau unauthenticated) tidak boleh tahu halaman
  // /admin ada. Return 404 supaya tidak bocorin keberadaan endpoint.
  const session = await getServerSession(authOptions);
  if (!session?.isAdmin) notFound();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 overflow-y-auto overflow-x-clip pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}
