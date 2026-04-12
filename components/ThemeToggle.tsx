"use client";

import { Sun, Moon, Palette } from "lucide-react";
import { useTheme, COLOR_THEMES, type ColorTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const { theme, toggle, colorTheme, setThemeColor } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {/* Dark/Light toggle */}
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle mode">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Color theme picker */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Palette className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Tema Warna</div>
          <DropdownMenuSeparator />
          {COLOR_THEMES.map((t) => (
            <DropdownMenuItem
              key={t.value}
              className={cn(
                "cursor-pointer gap-2",
                colorTheme === t.value && "font-semibold"
              )}
              onClick={() => setThemeColor(t.value as ColorTheme)}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                style={{ background: t.color }}
              />
              {t.label}
              {colorTheme === t.value && (
                <span className="ml-auto text-xs">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
