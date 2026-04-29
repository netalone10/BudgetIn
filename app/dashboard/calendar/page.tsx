import { CalendarDays } from "lucide-react";
import CalendarClient from "./CalendarClient";

export default function CalendarPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Kalender Keuangan</h1>
          <p className="text-xs text-muted-foreground">Lihat cashflow harianmu</p>
        </div>
      </div>
      <CalendarClient />
    </div>
  );
}
