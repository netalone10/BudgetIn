"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { X, Check, Loader2, Shuffle } from "lucide-react";
import { createAvatar } from "@dicebear/core";
import { AVATAR_STYLES, buildDicebearImage, type AvatarStyleId } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AvatarPickerModalProps {
  currentImage: string | null | undefined;
  userName: string;
  onClose: () => void;
  onSaved: (newImage: string) => void;
}

const SEED_VARIANTS = 12;

function generateSeeds(base: string): string[] {
  return Array.from({ length: SEED_VARIANTS }, (_, i) =>
    i === 0 ? base : `${base}-${i}`
  );
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function AvatarPickerModal({
  currentImage,
  userName,
  onClose,
  onSaved,
}: AvatarPickerModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyleId>("thumbs");
  const [selectedSeed, setSelectedSeed] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seeds = useMemo(() => generateSeeds(userName), [userName]);

  const previews = useMemo(() => {
    const styleEntry = AVATAR_STYLES.find((s) => s.id === selectedStyle);
    if (!styleEntry) return [];
    return seeds.map((seed) => ({
      seed,
      url: svgToDataUrl(createAvatar(styleEntry.style, { seed, size: 80 }).toString()),
    }));
  }, [selectedStyle, seeds]);

  const currentPreviewUrl = useMemo(() => {
    const styleEntry = AVATAR_STYLES.find((s) => s.id === selectedStyle);
    if (!styleEntry) return "";
    return svgToDataUrl(createAvatar(styleEntry.style, { seed: selectedSeed, size: 128 }).toString());
  }, [selectedStyle, selectedSeed]);

  function randomize() {
    const randomSeed = Math.random().toString(36).slice(2, 10);
    setSelectedSeed(randomSeed);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const imageValue = buildDicebearImage(selectedStyle, selectedSeed);
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan avatar.");
        return;
      }
      onSaved(imageValue);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-[28px] border border-border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pilih Avatar</h2>
            <p className="text-xs text-muted-foreground">Pilih style dan variasi yang kamu suka</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Preview besar + tombol random */}
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-muted">
            {currentPreviewUrl && (
              <Image src={currentPreviewUrl} alt="preview" width={80} height={80} unoptimized />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Style: <span className="font-medium text-foreground">{AVATAR_STYLES.find((s) => s.id === selectedStyle)?.label}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5 rounded-xl text-xs"
              onClick={randomize}
            >
              <Shuffle className="size-3" />
              Acak seed
            </Button>
          </div>
        </div>

        {/* Style selector */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStyle(s.id)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedStyle === s.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Variant grid */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variasi</p>
          <div className="grid grid-cols-6 gap-2">
            {previews.map(({ seed, url }) => (
              <button
                key={seed}
                onClick={() => setSelectedSeed(seed)}
                className={cn(
                  "relative overflow-hidden rounded-full border-2 transition-all",
                  selectedSeed === seed
                    ? "border-primary shadow-md"
                    : "border-transparent hover:border-primary/40"
                )}
              >
                <Image src={url} alt={seed} width={48} height={48} unoptimized className="size-full" />
                {selectedSeed === seed && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20">
                    <Check className="size-3.5 text-primary" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button className="flex-1 rounded-2xl" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}
