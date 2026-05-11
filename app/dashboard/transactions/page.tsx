import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import TransactionsClient from "./TransactionsClient";

export const metadata = { title: "Transaksi | BudgetIn" };

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/auth");

  return <TransactionsClient />;
}
