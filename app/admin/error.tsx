"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
      <div className="size-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Terjadi kesalahan
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {error.message}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="size-3.5" /> Muat ulang
        </button>
        <Link
          href="/admin"
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          Kembali ke admin
        </Link>
      </div>
    </div>
  );
}
