"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProfileImageProps {
  src: string | null | undefined;
  alt: string;
  size: number;
  className?: string;
}

/**
 * Optimized profile image component using Next.js <Image> for Google profile pictures.
 * Provides automatic format negotiation (WebP/AVIF), lazy loading, and explicit
 * width/height to prevent layout shift (CLS).
 */
export function ProfileImage({ src, alt, size, className }: ProfileImageProps) {
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("aspect-square size-full rounded-full object-cover", className)}
      referrerPolicy="no-referrer"
    />
  );
}
