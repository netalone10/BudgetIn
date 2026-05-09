"use client";

import { AlertTriangle } from "lucide-react";
import { useIsDemo } from "@/lib/hooks/use-is-demo";

export default function DemoModeBanner() {
  const isDemo = useIsDemo();
  if (!isDemo) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs py-2 px-4 rounded-lg mb-4">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>
        <strong>Demo Mode</strong> — Perubahan tidak akan disimpan. Akun ini hanya untuk melihat-lihat.
      </span>
    </div>
  );
}
