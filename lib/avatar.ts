import { createAvatar, type Style } from "@dicebear/core";
import {
  adventurer,
  avataaars,
  bottts,
  funEmoji,
  lorelei,
  micah,
  pixelArt,
  thumbs,
} from "@dicebear/collection";

export const AVATAR_STYLES = [
  { id: "adventurer", label: "Adventurer", style: adventurer as Style<object> },
  { id: "avataaars", label: "Avataaars", style: avataaars as Style<object> },
  { id: "bottts", label: "Bottts", style: bottts as Style<object> },
  { id: "funEmoji", label: "Fun Emoji", style: funEmoji as Style<object> },
  { id: "lorelei", label: "Lorelei", style: lorelei as Style<object> },
  { id: "micah", label: "Micah", style: micah as Style<object> },
  { id: "pixelArt", label: "Pixel Art", style: pixelArt as Style<object> },
  { id: "thumbs", label: "Thumbs", style: thumbs as Style<object> },
] as const;

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];

/** Parse a dicebear image string: "dicebear:style:seed" */
export function parseDicebearImage(image: string | null | undefined): {
  styleId: AvatarStyleId;
  seed: string;
} | null {
  if (!image?.startsWith("dicebear:")) return null;
  const parts = image.split(":");
  if (parts.length < 3) return null;
  const styleId = parts[1] as AvatarStyleId;
  const seed = parts.slice(2).join(":");
  if (!AVATAR_STYLES.find((s) => s.id === styleId)) return null;
  return { styleId, seed };
}

/** Build the "dicebear:style:seed" storage string */
export function buildDicebearImage(styleId: AvatarStyleId, seed: string): string {
  return `dicebear:${styleId}:${seed}`;
}

/** Generate an SVG data URL from a dicebear image string or fallback seed */
export function getDicebearSvg(
  image: string | null | undefined,
  fallbackSeed: string,
  size = 64
): string {
  const parsed = parseDicebearImage(image);
  const styleId = parsed?.styleId ?? "thumbs";
  const seed = parsed?.seed ?? fallbackSeed;

  const styleEntry = AVATAR_STYLES.find((s) => s.id === styleId);
  if (!styleEntry) return "";

  const svg = createAvatar(styleEntry.style, { seed, size }).toString();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
