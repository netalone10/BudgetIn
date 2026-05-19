import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TestimoniForm from "./TestimoniForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tulis Testimoni",
  description:
    "Bagikan pengalamanmu pakai BudgetIn. Testimoni kamu akan tampil di landing page setelah di-review admin.",
};

export default async function TestimoniPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    redirect("/auth?next=/testimoni");
  }

  // Cek apakah user sudah pernah submit testimoni.
  const latest = await prisma.testimonial.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      approved: true,
      approvedAt: true,
      createdAt: true,
      quote: true,
      role: true,
      rating: true,
    },
  });

  return (
    <TestimoniForm
      userName={session.user?.name ?? "Pengguna BudgetIn"}
      existing={latest}
    />
  );
}
