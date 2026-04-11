"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BudgetSummary {
  category: string;
  budget: number;
  spent: number;
}

interface ReportData {
  period: string;
  totalSpent: number;
  spentByCategory: Record<string, number>;
  budgets: BudgetSummary[];
  summary: string;
  transactionCount: number;
}

interface Props {
  data: ReportData;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID").format(amount);
}

export default function ReportView({ data }: Props) {
  const categories = Object.entries(data.spentByCategory).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span>📊</span>
          <span>Laporan — {data.period}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            Rp {formatRupiah(data.totalSpent)}
          </span>
          <span className="text-xs text-muted-foreground">
            dari {data.transactionCount} transaksi
          </span>
        </div>

        {/* Per kategori */}
        {categories.length > 0 && (
          <div className="space-y-1">
            {categories.map(([cat, spent]) => {
              const budget = data.budgets.find((b) => b.category === cat);
              const pct = budget ? (spent / budget.budget) * 100 : null;

              return (
                <div
                  key={cat}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        pct !== null && pct >= 100
                          ? "bg-destructive"
                          : pct !== null && pct >= 80
                          ? "bg-yellow-500"
                          : "bg-primary"
                      )}
                    />
                    <span>{cat}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-medium tabular-nums">
                      Rp {formatRupiah(spent)}
                    </span>
                    {budget && (
                      <span
                        className={cn(
                          "text-xs",
                          pct! >= 100
                            ? "text-destructive"
                            : pct! >= 80
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-muted-foreground"
                        )}
                      >
                        / {formatRupiah(budget.budget)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI Summary */}
        {data.summary && (
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30">
            {data.summary}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
