"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {/* Dark/Light toggle */}
      <Button variant="ghost" size={compact ? "icon-xs" : "icon"} onClick={toggle} aria-label="Toggle mode">
        {theme === "dark" ? <Sun className={compact ? "size-3" : "size-4"} /> : <Moon className={compact ? "size-3" : "size-4"} />}
      </Button>
    </div>
  );
}
