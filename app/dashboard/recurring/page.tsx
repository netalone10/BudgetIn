import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RecurringClient from "./RecurringClient";

export const metadata = { title: "Berulang | BudgetIn" };

export default async function RecurringPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  return <RecurringClient />;
}
