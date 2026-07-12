"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2, Plus, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccountTypeOption {
  id: string;
  name: string;
  classification: "asset" | "liability";
}

interface DraftAccount {
  name: string;
  typeName: string;
  classification: "asset" | "liability";
  saldoAwal: number;
  currency: string;
  creditLimit?: number;
  tanggalSettlement?: number;
  tanggalJatuhTempo?: number;
}

type Phase = "prompt" | "preview" | "result";

interface CommitResult {
  created: Array<{ id: string; name: string; currentBalance: string }>;
  failed: Array<{ name: string; error: string }>;
}

const PLACEHOLDER = `Contoh: "BCA 5jt, GoPay 200rb, cash 100rb, kartu kredit BNI"`;

export default function SetupAccountsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<DraftAccount[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeOption[]>([]);
  const [result, setResult] = useState<CommitResult | null>(null);

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memproses. Coba lagi.");
        return;
      }
      setAccountTypes(data.accountTypes ?? []);
      if (!data.accounts || data.accounts.length === 0) {
        setError(data.clarification || "Tidak ada akun terdeteksi. Coba tulis lebih jelas.");
        return;
      }
      setDrafts(data.accounts);
      setPhase("preview");
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(i: number, patch: Partial<DraftAccount>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function handleTypeChange(i: number, typeName: string) {
    const t = accountTypes.find((x) => x.name === typeName);
    updateDraft(i, {
      typeName,
      classification: t?.classification ?? (typeName === "Kartu Kredit" || typeName === "Hutang" ? "liability" : "asset"),
    });
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addDraft() {
    const fallback = accountTypes[0];
    setDrafts((prev) => [
      ...prev,
      {
        name: "",
        typeName: fallback?.name ?? "Kas",
        classification: fallback?.classification ?? "asset",
        saldoAwal: 0,
        currency: "IDR",
      },
    ]);
  }

  async function handleCommit() {
    if (loading) return;
    const valid = drafts.filter((d) => d.name.trim());
    if (valid.length === 0) {
      setError("Isi minimal satu nama akun.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", accounts: valid }),
      });
      const data = await res.json();
      if (!res.ok && !data.created) {
        setError(data.error || "Gagal membuat akun.");
        return;
      }
      setResult({ created: data.created ?? [], failed: data.failed ?? [] });
      setPhase("result");
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Setup Akun dengan AI
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {/* ── Phase: prompt ─────────────────────────────────────────────── */}
        {phase === "prompt" && (
          <form onSubmit={handleParse} className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground">
              Sebutkan akun-akunmu beserta saldonya dalam satu kalimat. AI akan menyusunnya jadi
              daftar yang bisa kamu cek dulu sebelum dibuat.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              autoFocus
              placeholder={PLACEHOLDER}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="text-xs text-red-500 flex items-start gap-1.5"><AlertCircle className="size-3.5 shrink-0 mt-0.5" />{error}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
              <Button type="submit" className="flex-1 gap-1.5" disabled={!prompt.trim() || loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <><Sparkles className="size-4" /> Lihat Preview</>}
              </Button>
            </div>
          </form>
        )}

        {/* ── Phase: preview ────────────────────────────────────────────── */}
        {phase === "preview" && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Cek & sesuaikan akun di bawah. Saldo dicatat sebagai transaksi &quot;Saldo Awal&quot;.
              </p>
              {drafts.map((d, i) => (
                <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={d.name}
                      maxLength={50}
                      onChange={(e) => updateDraft(i, { name: e.target.value })}
                      placeholder="Nama akun"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeDraft(i)}
                      className="text-muted-foreground hover:text-red-500 p-2"
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={d.typeName}
                      onChange={(e) => handleTypeChange(i, e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {accountTypes.length === 0 && <option value={d.typeName}>{d.typeName}</option>}
                      {accountTypes.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.classification === "asset" ? "Aset" : "Liabilitas"})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={d.saldoAwal || ""}
                      onChange={(e) => updateDraft(i, { saldoAwal: Math.max(0, Number(e.target.value) || 0) })}
                      placeholder="Saldo awal (Rp)"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {d.typeName === "Kartu Kredit" && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={d.creditLimit || ""}
                        onChange={(e) =>
                          updateDraft(i, {
                            creditLimit:
                              Math.max(0, Number(e.target.value) || 0) || undefined,
                          })
                        }
                        placeholder="Limit (Rp)"
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={d.tanggalSettlement || ""}
                        onChange={(e) =>
                          updateDraft(i, {
                            tanggalSettlement:
                              Math.min(31, Math.max(1, Number(e.target.value) || 0)) ||
                              undefined,
                          })
                        }
                        placeholder="Settlement"
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={d.tanggalJatuhTempo || ""}
                        onChange={(e) =>
                          updateDraft(i, {
                            tanggalJatuhTempo:
                              Math.min(31, Math.max(1, Number(e.target.value) || 0)) ||
                              undefined,
                          })
                        }
                        placeholder="Jatuh tempo"
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDraft}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:text-primary hover:border-primary/50"
              >
                <Plus className="size-3.5" /> Tambah baris
              </button>
              {error && <p className="text-xs text-red-500 flex items-start gap-1.5"><AlertCircle className="size-3.5 shrink-0 mt-0.5" />{error}</p>}
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <Button type="button" variant="outline" className="flex-1 gap-1.5" onClick={() => { setPhase("prompt"); setError(null); }} disabled={loading}>
                <ArrowLeft className="size-4" /> Kembali
              </Button>
              <Button type="button" className="flex-1" onClick={handleCommit} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : `Konfirmasi & Buat (${drafts.filter((d) => d.name.trim()).length})`}
              </Button>
            </div>
          </>
        )}

        {/* ── Phase: result ─────────────────────────────────────────────── */}
        {phase === "result" && result && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {result.created.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {result.created.length} akun berhasil dibuat
                  </p>
                  {result.created.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <span className="flex-1">{a.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        Rp {Number(a.currentBalance).toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-red-500">{result.failed.length} gagal</p>
                  {result.failed.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="size-4 text-red-500 shrink-0" />
                      <span className="flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{f.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-border">
              <Button type="button" className="w-full" onClick={onSaved}>Selesai</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
