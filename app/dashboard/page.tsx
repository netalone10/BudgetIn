import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

/**
 * Dashboard page — thin auth wrapper only.
 * No server-side data fetching. DashboardClient handles all data client-side
 * for instant shell rendering. The shell (sidebar + greeting + layout)
 * appears immediately while data populates via SWR in the background.
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  return <DashboardClient />;
}
