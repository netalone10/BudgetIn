import { CalendarDays } from "lucide-react";
import CalendarClient from "./CalendarClient";

// User-specific mutable data — always fetch fresh
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CalendarPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kalender Keuangan</h1>
          <p className="text-xs text-muted-foreground">Lihat cashflow harianmu</p>
        </div>
      </div>
      <CalendarClient />
    </div>
  );
}
