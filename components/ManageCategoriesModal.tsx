"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Pencil, Trash2, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  type?: string;
  isSavings: boolean;
}

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export default function ManageCategoriesModal({ onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [newCatName, setNewCatName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      // Handle error gracefully
    } finally {
      setLoading(false);
    }
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

  async function handleRename(id: string) {
    if (!editName.trim()) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: editName.trim() } : c))
        );
        setEditingId(null);
        onSaved?.();
      } else {
        alert(data.error || "Gagal merubah nama");
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

  async function handleToggleSavings(id: string, currentValue: boolean) {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSavings: !currentValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isSavings: !currentValue } : c))
        );
      } else {
        alert(data.error || "Gagal mengubah status tabungan");
      }
    } catch {
      alert("Terjadi kesalahan");
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
  }

  const displayedCategories = categories.filter((c) => (c.type || "expense") === activeTab);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-semibold">Kelola Kategori</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
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
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-[50px] -mx-4 px-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : displayedCategories.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Belum ada kategori {activeTab === "expense" ? "pengeluaran" : "pemasukan"}
            </div>
          ) : (
            <div className="space-y-1">
              {displayedCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 rounded-lg group text-sm">
                  {editingId === c.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs flex-1"
                        maxLength={30}
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleRename(c.id)} disabled={savingId === c.id || !editName.trim()}>
                        {savingId === c.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)} disabled={savingId === c.id}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium truncate pr-4">{c.name}</span>
                      <div className="flex items-center gap-1">
                        {activeTab === "expense" && (
                          <button
                            onClick={() => handleToggleSavings(c.id, c.isSavings)}
                            disabled={savingId === c.id}
                            title={c.isSavings ? "Tandai bukan tabungan" : "Tandai sebagai tabungan"}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                              c.isSavings
                                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400"
                                : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-0 group-hover:opacity-100"
                            )}
                          >
                            💰 {c.isSavings ? "Tabungan" : "Tabungan?"}
                          </button>
                        )}
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)} disabled={savingId === c.id}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(c.id, c.name)} disabled={savingId === c.id}>
                            {savingId === c.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
