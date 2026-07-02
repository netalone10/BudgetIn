import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-4">
      <div className="size-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <FileQuestion className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Halaman tidak ditemukan
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
        </p>
      </div>
      <Link
        href="/auth/signin"
        className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        Kembali ke login
      </Link>
    </div>
  );
}
