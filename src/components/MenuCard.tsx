"use client";

import { useRef, useState } from "react";
import { Clock, Minus, Plus } from "@phosphor-icons/react";
import { Money } from "@/components/ui";
import MenuImage from "@/components/MenuImage";

export type MenuCardItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  available: boolean;
  prepMinutes?: number | null;
  photos?: { url: string; isPrimary: boolean }[];
};

/**
 * Kartu menu storefront: foto flush 1/3 kiri, ribbon "SOLD OUT" diagonal saat
 * habis (kartu dinonaktifkan), CTA +/- besar semi-transparan di kanan dengan
 * badge counter (muncul bila qty>0). Tap di kartu = tambah, dengan animasi tap.
 */
export default function MenuCard({
  item,
  qty,
  onAdd,
  onRemove,
}: {
  item: MenuCardItem;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const [pulse, setPulse] = useState(false);
  const pulseKey = useRef(0);
  const soldOut = !item.available;

  function tapAdd() {
    if (soldOut) return;
    pulseKey.current += 1;
    setPulse(true);
    onAdd();
  }

  return (
    <div
      key={pulseKey.current}
      onClick={tapAdd}
      onAnimationEnd={() => setPulse(false)}
      role="button"
      aria-disabled={soldOut}
      className={`relative flex min-h-28 select-none items-stretch overflow-hidden rounded-2xl border border-sunset-100 bg-white shadow-sm transition-transform ${
        soldOut ? "opacity-60" : "cursor-pointer active:scale-[0.98]"
      } ${pulse ? "tap-pulse" : ""}`}
    >
      <div className="relative w-1/3 shrink-0 overflow-hidden">
        <MenuImage photos={item.photos} alt={item.name} />
        {soldOut && <span className="soldout-ribbon">SOLD OUT</span>}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3.5">
        <div className="min-w-0">
          <p className="truncate font-bold">{item.name}</p>
          {item.description && <p className="line-clamp-2 text-xs text-ink/50">{item.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Money value={item.price} className="text-sm font-bold text-sunset-600" />
            {item.prepMinutes ? (
              <span className="flex items-center gap-0.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                <Clock size={10} weight="bold" /> ±{item.prepMinutes} mnt
              </span>
            ) : null}
          </div>
        </div>

        {/* CTA +/- — dihentikan agar tidak ikut memicu tap-add kartu */}
        {!soldOut && (
          <div className="flex shrink-0 flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              {qty > 0 && (
                <button
                  onClick={onRemove}
                  aria-label={`Kurangi ${item.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunset-500/15 text-sunset-700 transition-colors active:bg-sunset-500/30"
                >
                  <Minus size={18} weight="bold" />
                </button>
              )}
              <button
                onClick={onAdd}
                aria-label={`Tambah ${item.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunset-500/15 text-sunset-700 transition-colors active:bg-sunset-500/30"
              >
                <Plus size={18} weight="bold" />
              </button>
            </div>
            {qty > 0 && (
              <span className="rounded-full bg-sunset-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                {qty}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
