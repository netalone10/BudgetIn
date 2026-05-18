import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  dense?: boolean;
  children: ReactNode;
}

export function SectionCard({
  eyebrow,
  title,
  description,
  action,
  className,
  dense = false,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm sm:rounded-[30px]",
        dense ? "md:p-4" : "md:p-6",
        className
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          dense ? "mb-3" : "mb-5"
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
          <h3
            className={cn(
              "font-semibold tracking-tight text-foreground",
              dense ? "text-base sm:text-lg" : "text-lg sm:text-xl"
            )}
          >
            {title}
          </h3>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 self-start">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export default SectionCard;
