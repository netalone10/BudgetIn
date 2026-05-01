"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {/* Dark/Light toggle */}
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle mode">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
