import { Banknote } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  type BudgetCategoryOption,
  type BudgetMonthData,
  emptyBudgetMonthData,
  fetchBudgetCategories,
  fetchBudgetMonthData,
  getCurrentMonth,
  isValidMonth,
} from "@/lib/budget-data";
import { seedDefaultCategories } from "@/utils/seed-categories";
import BudgetClient from "./BudgetClient";

type Props = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function BudgetPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  const resolvedSearchParams = await searchParams;
  const requestedMonth = resolvedSearchParams?.month;
  const month = isValidMonth(requestedMonth) ? requestedMonth : getCurrentMonth();

  let loadError: string | null = null;

  try {
    await seedDefaultCategories(session.userId);
  } catch (error) {
    console.error("Failed to seed default categories on budget page:", error);
    loadError = "Sebagian data kategori gagal dimuat. Coba muat ulang halaman.";
  }

  let initialData: BudgetMonthData = emptyBudgetMonthData(month);
  let categories: BudgetCategoryOption[] = [];

  try {
    [initialData, categories] = await Promise.all([
      fetchBudgetMonthData(session.userId, month),
      fetchBudgetCategories(session.userId),
    ]);
  } catch (error) {
    console.error("Failed to load budget page data:", error);
    loadError = "Budget gagal dimuat. Coba muat ulang halaman.";
  }

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-6">
        <div className="flex items-center gap-3 pb-2 mt-4 md:mt-2">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Banknote className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Budget
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola budget bulanan, rollover kategori, dan copy budget dari bulan sebelumnya.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        )}

        <BudgetClient initialData={initialData} categories={categories} />
      </div>
    </div>
  );
}
