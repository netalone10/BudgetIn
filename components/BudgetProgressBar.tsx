import { cn } from "@/lib/utils";

type BudgetProgressBarProps = {
  fillPct: number;
  markerPct?: number;
  isOver?: boolean;
  isNear?: boolean;
  className?: string;
};

export function BudgetProgressBar({
  fillPct,
  markerPct,
  isOver = false,
  isNear = false,
  className,
}: BudgetProgressBarProps) {
  const fillWidth = Math.min(Math.max(fillPct, 0), 100);
  const markerLeft = markerPct == null ? null : Math.min(Math.max(markerPct, 0), 100);

  return (
    <div className={cn("relative h-1.5 w-full rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          isOver ? "bg-destructive" : isNear ? "bg-yellow-500" : "bg-primary"
        )}
        style={{ width: `${fillWidth}%` }}
      />
      {markerLeft != null && (
        <span
          className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/75 shadow-[0_0_0_2px_var(--background)]"
          style={{ left: `${markerLeft}%` }}
        />
      )}
    </div>
  );
}
