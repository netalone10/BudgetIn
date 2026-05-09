import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface ButtonColorfulProps {
  href: string;
  label: string;
  className?: string;
}

export function ButtonColorful({ href, label, className }: ButtonColorfulProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex h-11 min-w-44 items-center justify-center overflow-hidden rounded-lg px-6 text-sm font-semibold text-white shadow-[var(--shadow-offset-x)_var(--shadow-offset-y)_var(--shadow-blur)_var(--shadow-spread)_var(--shadow-color)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 dark:text-primary-foreground",
        "bg-zinc-900 dark:bg-primary",
        className
      )}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary to-primary opacity-40 blur transition-opacity duration-500 group-hover:opacity-80 dark:opacity-0 dark:group-hover:opacity-10" />
      <span className="relative flex items-center justify-center gap-2">
        <span>{label}</span>
        <ArrowUpRight className="size-3.5 text-white/90 dark:text-primary-foreground/90" />
      </span>
    </Link>
  );
}
