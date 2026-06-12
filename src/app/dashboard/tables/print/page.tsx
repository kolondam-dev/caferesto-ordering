"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Spinner } from "@/components/ui";

type TableT = { id: string; name: string; code: string | null };

/**
 * Halaman cetak QR meja — grid kartu siap print (Ctrl/Cmd+P).
 * QR mengarah ke {origin}/t/[code]; digenerate client-side (tanpa layanan eksternal).
 */
export default function PrintQRPage() {
  const [cards, setCards] = useState<{ name: string; url: string; dataUrl: string }[] | null>(null);

  useEffect(() => {
    (async () => {
      const { tables } = await api<{ tables: TableT[] }>("/api/tables");
      const origin = window.location.origin;
      const withCode = tables.filter((t) => t.code);
      const result = await Promise.all(
        withCode.map(async (t) => {
          const url = `${origin}/t/${t.code}`;
          const dataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: "#2b1d26" } });
          return { name: t.name, url, dataUrl };
        })
      );
      setCards(result);
    })();
  }, []);

  if (!cards) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-extrabold">Cetak QR Meja</h1>
          <p className="text-sm text-ink/60">Gunting kartu dan tempel di setiap meja. ({cards.length} meja)</p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer size={18} /> Cetak
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.name}
            className="break-inside-avoid rounded-2xl border-2 border-dashed border-ink/20 bg-white p-4 text-center"
          >
            <p className="text-lg font-extrabold">
              <span className="text-sunset-500">Cafe</span>
              <span className="text-violet-700">Resto</span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.dataUrl} alt={`QR ${c.name}`} className="mx-auto my-2 w-full max-w-[180px]" />
            <p className="text-base font-extrabold">{c.name}</p>
            <p className="mt-1 text-[10px] leading-snug text-ink/50">
              Scan untuk pesan dari HP Anda — tanpa antre, tanpa login.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
