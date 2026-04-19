"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Plus, Loader2, Tags, Edit2, Trash2, AlertCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccountType {
  id: string;
  name: string;
  classification: "asset" | "liability";
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const PRESET_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f97316",
  "#14b8a6", "#06b6d4", "#84cc16", "#ef4444", "#6b7280",
  "#ec4899", "#a855f7",
];

// ── Account Type Form Modal ───────────────────────────────────────────────────

interface TypeFormModalProps {
  editType?: AccountType;
  hasActiveAccounts?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function TypeFormModal({ editType, hasActiveAccounts, onClose, onSaved }: TypeFormModalProps) {
  const [name, setName] = useState(editType?.name ?? "");
  const [classification, setClassification] = useState<"asset" | "liability">(editType?.classification ?? "asset");
  const [color, setColor] = useState(editType?.color ?? "#3b82f6");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editType;
  const classificationLocked = isEdit && !!hasActiveAccounts;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = isEdit
        ? await fetch(`/api/account-types/${editType!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, classification, color }),
          })
        : await fetch("/api/account-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, classification, color }),
          });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal menyimpan."); return; }
      onSaved();
    } catch {
      setError("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">{isEdit ? "Edit Tipe Akun" : "Tambah Tipe Akun"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nama Tipe *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
              placeholder="Bank, E-Wallet, Reksadana..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Klasifikasi *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={classificationLocked}
                onClick={() => setClassification("asset")}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  classification === "asset"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    : "border-border text-muted-foreground hover:border-border/80",
                  classificationLocked && "opacity-50 cursor-not-allowed"
                )}
              >
                ✅ Aset
                <p className="text-[10px] font-normal mt-0.5">Menambah net worth</p>
              </button>
              <button
                type="button"
                disabled={classificationLocked}
                onClick={() => setClassification("liability")}
                className={cn(
                  "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  classification === "liability"
                    ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                    : "border-border text-muted-foreground hover:border-border/80",
                  classificationLocked && "opacity-50 cursor-not-allowed"
                )}
              >
                ⚠️ Liability
                <p className="text-[10px] font-normal mt-0.5">Mengurangi net worth</p>
              </button>
            </div>
            {classificationLocked && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Klasifikasi dikunci karena tipe ini sudah dipakai akun aktif.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Warna</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan" : "Tambah Tipe"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Type Card ─────────────────────────────────────────────────────────────────

function TypeCard({
  type,
  onEdit,
  onDelete,
  onArchive,
}: {
  type: AccountType;
  onEdit: (t: AccountType) => void;
  onDelete: (t: AccountType) => void;
  onArchive: (t: AccountType) => void;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border border-border bg-background p-3.5 gap-4",
      !type.isActive && "opacity-50"
    )}>
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: type.color }}
        >
          {type.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{type.name}</span>
            {!type.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Arsip</span>}
          </div>
          <span className={cn(
            "text-[10px] font-medium",
            type.classification === "asset" ? "text-emerald-500" : "text-red-500"
          )}>
            {type.classification === "asset" ? "Aset" : "Liability"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(type)}
          title="Edit"
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onArchive(type)}
          title="Arsipkan tipe"
          className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-colors"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(type)}
          title="Hapus permanen"
          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountTypesPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });

  const [types, setTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editType, setEditType] = useState<AccountType | null>(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account-types");
      const data = await res.json();
      setTypes(data.accountTypes ?? []);
    } catch {
      setError("Gagal memuat tipe akun.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchTypes();
  }, [status, fetchTypes]);

  async function handleArchive(type: AccountType) {
    if (!confirm(`Arsipkan tipe "${type.name}"? Tipe tidak akan muncul di dropdown baru, tapi akun yang sudah ada tetap aktif.`)) return;
    const res = await fetch(`/api/account-types/${type.id}?soft=true`, { method: "DELETE" });
    if (res.ok) fetchTypes();
    else {
      const d = await res.json();
      alert(d.error || "Gagal mengarsipkan.");
    }
  }

  async function handleDelete(type: AccountType) {
    if (!confirm(`Hapus permanen tipe "${type.name}"? Ini hanya bisa dilakukan jika tidak ada akun yang menggunakan tipe ini.`)) return;
    const res = await fetch(`/api/account-types/${type.id}`, { method: "DELETE" });
    if (res.ok) fetchTypes();
    else {
      const d = await res.json();
      alert(d.error || "Gagal menghapus. Mungkin masih ada akun yang menggunakan tipe ini.");
    }
  }

  const assets = types.filter((t) => t.classification === "asset");
  const liabilities = types.filter((t) => t.classification === "liability");

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Tags className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Tipe Akun</h1>
            <p className="text-xs text-muted-foreground">Kelola kategori akun kamu</p>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Tambah Tipe
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Tipe akun mengelompokkan akunmu dan menentukan apakah masuk hitungan <strong>aset</strong> (menambah net worth) atau <strong>liability</strong> (mengurangi net worth).
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl p-4">{error}</div>
      )}

      {/* Asset types */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Aset ({assets.length})
          </h3>
          {assets.map((t) => (
            <TypeCard
              key={t.id}
              type={t}
              onEdit={setEditType}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Liability types */}
      {liabilities.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Liability / Hutang ({liabilities.length})
          </h3>
          {liabilities.map((t) => (
            <TypeCard
              key={t.id}
              type={t}
              onEdit={setEditType}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {types.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Tags className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada tipe akun.</p>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <TypeFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchTypes(); }}
        />
      )}
      {editType && (
        <TypeFormModal
          editType={editType}
          onClose={() => setEditType(null)}
          onSaved={() => { setEditType(null); fetchTypes(); }}
        />
      )}
    </div>
  );
}
