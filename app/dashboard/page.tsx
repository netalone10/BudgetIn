import { fetchDashboardData } from "@/lib/dashboard-data";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const initialData = await fetchDashboardData();
  return <DashboardClient initialData={initialData} />;
}
