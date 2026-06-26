import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import FamilyClient from "./FamilyClient";

// Family Mode — konsolidasi keuangan keluarga (read-only consolidated).
export default async function FamilyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  return <FamilyClient />;
}
