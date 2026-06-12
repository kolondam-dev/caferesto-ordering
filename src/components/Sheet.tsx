"use client";

import { X } from "@phosphor-icons/react";

/**
 * Bottom sheet ala native mobile: slide-up dari bawah dengan drag-handle,
 * otomatis menjadi dialog tengah di layar md+. Pengganti seragam untuk
 * semua modal di aplikasi.
 */
export default function Sheet({
  title,
  onClose,
  children,
  wide,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className={`sheet-enter flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-white md:rounded-3xl ${
          wide ? "md:max-w-2xl" : "md:max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle (visual) */}
        <div className="flex justify-center pb-1 pt-2.5 md:hidden">
          <div className="h-1 w-10 rounded-full bg-ink/15" />
        </div>
        {title !== undefined && (
          <div className="flex items-center justify-between px-5 pb-2 pt-1 md:pt-4">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button onClick={onClose} className="text-ink/40" aria-label="Tutup">
              <X size={22} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
