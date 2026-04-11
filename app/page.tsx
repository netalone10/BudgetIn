import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import SignInButton from "@/components/SignInButton";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal navbar */}
      <header className="flex h-14 items-center justify-between border-b px-6">
        <span className="font-bold tracking-tight">Catatuang</span>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
        <div className="space-y-3 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Catat pengeluaran,{" "}
            <span className="text-primary">pahami uangmu</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Cukup ketik seperti chat biasa.{" "}
            <span className="font-medium text-foreground">
              &quot;Makan siang 35rb&quot;
            </span>{" "}
            — Catatuang proses sisanya.
          </p>
        </div>

        {/* Contoh input */}
        <div className="w-full max-w-sm space-y-2 rounded-xl border bg-muted/40 p-4 text-left text-sm">
          {[
            { input: "Makan siang 35rb", output: "✓ Makan — Rp 35.000" },
            { input: "Naik Grab ke kantor 22rb", output: "✓ Transport — Rp 22.000" },
            { input: "Budget makan bulan ini 500rb", output: "✓ Budget Makan: Rp 500.000" },
            { input: "Rekap pengeluaran minggu ini", output: "📊 Total: Rp 247.000 ..." },
          ].map(({ input, output }) => (
            <div key={input} className="space-y-0.5">
              <p className="text-foreground">{input}</p>
              <p className="text-muted-foreground pl-2">→ {output}</p>
            </div>
          ))}
        </div>

        <SignInButton />

        <p className="text-xs text-muted-foreground">
          Data tersimpan di Google Sheets milikmu sendiri.
        </p>
      </main>
    </div>
  );
}
