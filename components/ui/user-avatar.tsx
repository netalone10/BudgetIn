"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { getDicebearSvg, parseDicebearImage } from "@/lib/avatar";

interface UserAvatarProps {
  /** The user's image field from DB (Google URL, dicebear string, or null) */
  image: string | null | undefined;
  /** Fallback seed (name or email) used when no image is set */
  name: string;
  size?: number;
  className?: string;
}

/**
 * Unified avatar component:
 * - Google users: renders their Google profile photo
 * - Email users with dicebear selection: renders the chosen DiceBear SVG
 * - Email users without selection: renders a default DiceBear avatar from their name
 */
export function UserAvatar({ image, name, size = 32, className }: UserAvatarProps) {
  const isDicebear = parseDicebearImage(image) !== null;
  const isGooglePhoto = image && !isDicebear && image.startsWith("http");

  if (isGooglePhoto) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className={cn("aspect-square rounded-full object-cover", className)}
        referrerPolicy="no-referrer"
      />
    );
  }

  // DiceBear (or fallback default)
  const svgUrl = getDicebearSvg(image, name, size * 2);

  return (
    <Image
      src={svgUrl}
      alt={name}
      width={size}
      height={size}
      className={cn("aspect-square rounded-full", className)}
      unoptimized
    />
  );
}
