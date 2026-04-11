"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BudgetItem {
  id: string;
  category: string;
  budget: number;
  spent: number;
}

function formatRupiah(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`;
  return amount.toString();
}

export default function BudgetStatus() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/budget")
      .then((r) => r.json())
      .then((data) => {
        setBudgets(data.budgets ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Status Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1 animate-pulse">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-2 w-full rounded bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Status Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Belum ada budget. Ketik{" "}
            <span className="font-medium text-foreground">
              &quot;Budget makan 500rb&quot;
            </span>{" "}
            untuk mulai.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Status Budget Bulan Ini
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.map((item) => {
          const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
          const isOver = pct >= 100;
          const isNear = pct >= 80 && !isOver;

          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.category}</span>
                <span
                  className={cn(
                    "text-xs",
                    isOver && "text-destructive font-semibold",
                    isNear && "text-yellow-600 dark:text-yellow-400 font-semibold",
                    !isOver && !isNear && "text-muted-foreground"
                  )}
                >
                  {formatRupiah(item.spent)} / {formatRupiah(item.budget)}
                  {isOver && " ⚠ Melebihi!"}
                  {isNear && " ⚠ Hampir habis"}
                </span>
              </div>
              <Progress
                value={Math.min(pct, 100)}
                className={cn(
                  "h-2",
                  isOver && "[&>div]:bg-destructive",
                  isNear && "[&>div]:bg-yellow-500"
                )}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
