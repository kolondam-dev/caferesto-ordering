"use client";

import { ForkKnife } from "@phosphor-icons/react";

/**
 * Foto utama menu dengan fallback gradien (saat belum ada foto).
 * Dipakai flush (tanpa margin/padding) di sisi kiri kartu menu.
 */
export default function MenuImage({
  photos,
  alt,
  className = "",
}: {
  photos?: { url: string; isPrimary: boolean }[];
  alt: string;
  className?: string;
}) {
  const primary = photos?.find((p) => p.isPrimary) ?? photos?.[0];
  if (primary) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={primary.url} alt={alt} className={`h-full w-full object-cover ${className}`} loading="lazy" />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-sunset-100 via-gold-100 to-violet-100 ${className}`}
    >
      <ForkKnife size={28} className="text-sunset-300" />
    </div>
  );
}
