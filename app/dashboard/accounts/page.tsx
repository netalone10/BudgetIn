import { Wallet } from "lucide-react";
import AccountsClient from "./AccountsClient";

// Server shell merender heading instan sebagai LCP element.
// Konten interaktif (list akun, modal, dsb.) di-render oleh `AccountsClient`
// setelah hydrate.
export default function AccountsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Akun & Dompet</h1>
          <p className="text-xs text-muted-foreground">
            Lacak saldo dan kekayaan bersih
          </p>
        </div>
      </div>
      <AccountsClient />
    </div>
  );
}
