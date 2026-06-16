"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2, Plus, X, RotateCcw } from "lucide-react";
import { useApi } from "@/lib/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveBudgetType, type BudgetType } from "@/utils/budget-type";
import { getCategoryIcon, ICON_PICKER_OPTIONS } from "@/utils/category-icons";

interface Category {
  id: string;
  name: string;
  type?: string;
  icon?: string | null;
  isSavings: boolean;
  budgetType?: BudgetType;
}

export default function CategoriesPage() {
  const { data: categoriesData, isLoading } = useApi<{ categories: Category[] }>("/api/categories");
  const [categories, setCategories] = useState<Category[]>([]);

  // Sync the editable local copy whenever the server returns a new array
  // (render-phase update; avoids a setState-in-effect).
  const serverCategories = categoriesData?.categories;
  const [syncedServer, setSyncedServer] = useState<Category[] | undefined>(undefined);
  if (serverCategories && serverCategories !== syncedServer) {
    setSyncedServer(serverCategories);
    setCategories(serverCategories);
  }

  const loading = isLoading && categories.length === 0;

  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [newCatName, setNewCatName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function notifyChanged() {
    window.dispatchEvent(new CustomEvent("categoriesChanged"));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), type: activeTab }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCatName("");
        notifyChanged();
      } else {
        alert(data.error || "Gagal menambah kategori");
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSaveEdit(payload: {
    id: string;
    name: string;
    icon: string | null;
    budgetType: BudgetType;
  }) {
    const original = categories.find((c) => c.id === payload.id);
    if (!original) return;

    const body: Record<string, unknown> = {};
    const trimmedName = payload.name.trim();
    if (trimmedName && trimmedName !== original.name) body.name = trimmedName;
    if (payload.icon !== (original.icon ?? null)) body.icon = payload.icon;
    if (payload.budgetType !== resolveBudgetType(original.name, original.budgetType)) {
      body.budgetType = payload.budgetType;
    }

    if (Object.keys(body).length === 0) {
      setEditingCategory(null);
      return;
    }

    setSavingId(payload.id);
    try {
      const res = await fetch(`/api/categories/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === payload.id
              ? { ...c, name: trimmedName || c.name, icon: payload.icon, budgetType: payload.budgetType }
              : c
          )
        );
        setEditingCategory(null);
        notifyChanged();
      } else {
        alert(data.error || "Gagal menyimpan perubahan");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus kategori "${name}"? Kategori pada transaksi lama tidak akan berubah.`)) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        notifyChanged();
      } else {
        alert("Gagal menghapus kategori");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSavingId(null);
    }
  }

  const allInTab = categories.filter((c) => (c.type || "expense") === activeTab);
  const displayedCategories = activeTab === "expense"
    ? allInTab.filter((c) => !c.isSavings)
    : allInTab;
  const savingsCategories = activeTab === "expense"
    ? allInTab.filter((c) => c.isSavings)
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Kelola Kategori</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tambah, edit, atau hapus kategori pengeluaran dan pemasukan kamu.
        </p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        {/* Tabs */}
        <div className="flex border-b">
          {(["expense", "income"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors first:rounded-tl-2xl last:rounded-tr-2xl",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "expense" ? "Pengeluaran" : "Pemasukan"}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {/* Form Add */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              placeholder="Nama kategori baru..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              disabled={isAdding || loading}
              maxLength={30}
            />
            <Button type="submit" disabled={!newCatName.trim() || isAdding || loading}>
              {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </form>

          {/* List */}
          <div className="min-h-[80px]">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : displayedCategories.length === 0 && savingsCategories.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Belum ada kategori {activeTab === "expense" ? "pengeluaran" : "pemasukan"}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Kategori pengeluaran biasa */}
                {displayedCategories.length > 0 && (
                  <div className="divide-y divide-border/60">
                    {displayedCategories.map((c) => <CategoryRow key={c.id} c={c} activeTab={activeTab} savingId={savingId} onEdit={setEditingCategory} onDelete={handleDelete} />)}
                  </div>
                )}

                {/* Kategori Tabungan — dipisah jelas */}
                {savingsCategories.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>🏦</span> Kategori Tabungan
                    </p>
                    <div className="divide-y divide-border/60 rounded-xl border border-dashed border-border bg-muted/20">
                      {savingsCategories.map((c) => <CategoryRow key={c.id} c={c} activeTab={activeTab} savingId={savingId} onEdit={setEditingCategory} onDelete={handleDelete} />)}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Kategori ini tidak muncul di dropdown pengeluaran — sudah dikelola lewat halaman Tabungan.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingCategory && (
        <EditCategoryModal
        category={editingCategory}
        saving={savingId === editingCategory.id}
        onClose={() => setEditingCategory(null)}
        onSave={handleSaveEdit}
      />
      )}
    </div>
  );
}

function CategoryRow({
  c,
  activeTab,
  savingId,
  onEdit,
  onDelete,
}: {
  c: Category;
  activeTab: "expense" | "income";
  savingId: string | null;
  onEdit: (c: Category) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 group">
      <span className="flex items-center gap-2 text-sm font-medium min-w-0">
        <span className="text-base leading-none">{getCategoryIcon(c.name, c.icon)}</span>
        <span className="truncate">{c.name}</span>
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {activeTab === "expense" && !c.isSavings && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            resolveBudgetType(c.name, c.budgetType) === "fixed"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
              : "bg-muted text-muted-foreground"
          )}>
            {resolveBudgetType(c.name, c.budgetType) === "fixed" ? "Fixed" : "Variable"}
          </span>
        )}
        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => onEdit(c)} disabled={savingId === c.id}>
            <Pencil className="size-3" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 hover:text-destructive" onClick={() => onDelete(c.id, c.name)} disabled={savingId === c.id}>
            {savingId === c.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface EditCategoryModalProps {
  category: Category;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { id: string; name: string; icon: string | null; budgetType: BudgetType }) => void;
}

function EditCategoryModal({ category, saving, onClose, onSave }: EditCategoryModalProps) {
  const isExpense = (category.type || "expense") === "expense";
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState<string | null>(category.icon ?? null);
  const [budgetType, setBudgetType] = useState<BudgetType>(resolveBudgetType(category.name, category.budgetType));
  const defaultIcon = getCategoryIcon(name || category.name);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: category.id, name, icon, budgetType });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
        onKeyDown={(e) => { if (e.key === "Escape" && !saving) onClose(); }}
        role="button"
        tabIndex={-1}
      />
      <form
        onSubmit={handleSubmit}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Edit Kategori</h3>
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nama */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nama kategori</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} disabled={saving} autoFocus />
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Icon</label>
              {icon && (
                <button type="button" onClick={() => setIcon(null)} disabled={saving}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCcw className="size-3" /> Reset ke default
                </button>
              )}
            </div>
            {/* Preview */}
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl border bg-muted text-xl">
                {icon ?? defaultIcon}
              </span>
              <span className="text-xs text-muted-foreground">
                {icon ? "Icon kustom" : "Default dari nama"}
              </span>
            </div>
            {/* Grid */}
            <div className="grid grid-cols-10 gap-1 rounded-xl border bg-muted/30 p-2">
              {ICON_PICKER_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  disabled={saving}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-base transition-colors hover:bg-background",
                    icon === emoji && "bg-primary/15 ring-1 ring-primary"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Budget type — expense only */}
          {isExpense && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipe budget</label>
              <div className="grid grid-cols-2 gap-2">
                {(["fixed", "variable"] as const).map((opt) => (
                  <button key={opt} type="button" onClick={() => setBudgetType(opt)} disabled={saving}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      budgetType === opt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                    )}>
                    {opt === "fixed" ? "Fixed" : "Variable"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fixed dihitung 100% dari budget. Variable diprorata terhadap hari berjalan.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Simpan"}
          </Button>
        </div>
      </form>
    </>
  );
}
