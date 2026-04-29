import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BillsClient from "./BillsClient";

export const metadata = { title: "Tagihan Rutin | BudgetIn" };

export default async function BillsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  return <BillsClient />;
}
