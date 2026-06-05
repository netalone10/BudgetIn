"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { useApi } from "@/lib/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveBudgetType, type BudgetType } from "@/utils/budget-type";
import { getCategoryIcon } from "@/utils/category-icons";

interface Category {
  id: string;
  name: string;
  type?: string;
  isSavings: boolean;
  budgetType?: BudgetType;
}

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export default function ManageCategoriesModal({ onClose, onSaved }: Props) {
  const { data: categoriesData, isLoading } = useApi<{ categories: Category[] }>("/api/categories");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (categoriesData?.categories) {
      setCategories(categoriesData.categories);
    }
  }, [categoriesData]);

  const loading = isLoading && categories.length === 0;

  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [newCatName, setNewCatName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);

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
        onSaved?.();
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
    budgetType: BudgetType;
    isSavings: boolean;
  }) {
    const original = categories.find((c) => c.id === payload.id);
    if (!original) return;

    const body: Record<string, unknown> = {};
    const trimmedName = payload.name.trim();
    if (trimmedName && trimmedName !== original.name) body.name = trimmedName;
    if (payload.budgetType !== resolveBudgetType(original.name, original.budgetType)) {
      body.budgetType = payload.budgetType;
    }
    if (payload.isSavings !== original.isSavings) body.isSavings = payload.isSavings;

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
              ? {
                  ...c,
                  name: trimmedName || c.name,
                  budgetType: payload.budgetType,
                  isSavings: payload.isSavings,
                }
              : c
          )
        );
        setEditingCategory(null);
        onSaved?.();
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
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        onSaved?.();
      } else {
        alert("Gagal menghapus kategori");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setSavingId(null);
    }
  }



  const displayedCategories = categories.filter((c) => (c.type || "expense") === activeTab);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="button"
        tabIndex={-1}
      />

      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-semibold">Kelola Kategori</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4 shrink-0">
          {(["expense", "income"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex-1",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "expense" ? "Pengeluaran" : "Pemasukan"}
            </button>
          ))}
        </div>

        {/* Form Add */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4 shrink-0">
          <Input 
            placeholder="Kategori baru..." 
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
        <div className="flex-1 overflow-y-auto min-h-[50px] -mx-4 px-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayedCategories.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Belum ada kategori {activeTab === "expense" ? "pengeluaran" : "pemasukan"}
            </div>
          ) : (
            <div className="space-y-1">
              {displayedCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2 px-3 hover:bg-muted/30 rounded-lg group text-sm">
                  <span className="font-medium truncate pr-4">
                    <span className="mr-2">{getCategoryIcon(c.name)}</span>{c.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {activeTab === "expense" && (
                      <>
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            resolveBudgetType(c.name, c.budgetType) === "fixed"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {resolveBudgetType(c.name, c.budgetType) === "fixed" ? "Fixed" : "Variable"}
                        </span>
                        {c.isSavings && (
                          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            💰 Tabungan
                          </span>
                        )}
                      </>
                    )}
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingCategory(c)} disabled={savingId === c.id}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 hover:text-destructive" onClick={() => handleDelete(c.id, c.name)} disabled={savingId === c.id}>
                        {savingId === c.id ? <Loader2 className="size-3 animate-spin"/> : <Trash2 className="size-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
    </>
  );
}

interface EditCategoryModalProps {
  category: Category;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { id: string; name: string; budgetType: BudgetType; isSavings: boolean }) => void;
}

function EditCategoryModal({ category, saving, onClose, onSave }: EditCategoryModalProps) {
  const isExpense = (category.type || "expense") === "expense";
  const [name, setName] = useState(category.name);
  const [budgetType, setBudgetType] = useState<BudgetType>(
    resolveBudgetType(category.name, category.budgetType)
  );
  const [isSavings, setIsSavings] = useState(category.isSavings);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: category.id, name, budgetType, isSavings });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
        onKeyDown={(e) => { if (e.key === "Escape" && !saving) onClose(); }}
        role="button"
        tabIndex={-1}
      />

      <form
        onSubmit={handleSubmit}
        className="fixed left-1/2 top-1/2 z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Edit Kategori</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nama kategori</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              disabled={saving}
              autoFocus
            />
          </div>

          {isExpense && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipe budget</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["fixed", "variable"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setBudgetType(opt)}
                      disabled={saving}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        budgetType === opt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {opt === "fixed" ? "Fixed" : "Variable"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Fixed dihitung 100% dari budget. Variable diprorata terhadap hari berjalan.
                </p>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Kategori tabungan</span>
                  <p className="text-[11px] text-muted-foreground">Dihitung sebagai saving, bukan pengeluaran.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isSavings}
                  onChange={(e) => setIsSavings(e.target.checked)}
                  disabled={saving}
                  className="size-4 accent-primary"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Simpan"}
          </Button>
        </div>
      </form>
    </>
  );
}
