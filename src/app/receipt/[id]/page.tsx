"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, DownloadSimple } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Spinner } from "@/components/ui";
import Receipt, { type ReceiptData } from "@/components/Receipt";

type OrderResp = {
  order: {
    code: string; createdAt: string; closedAt?: string | null; splitMode?: string | null;
    table?: { name: string } | null;
    items: ReceiptData["items"];
    participants?: ReceiptData["participants"];
    payments: ReceiptData["payments"];
  };
  bill: ReceiptData["bill"];
};

/**
 * Halaman struk digital — dipakai kasir (cetak browser) maupun customer
 * (lihat/unduh: tombol cetak di HP menawarkan "Simpan sebagai PDF").
 */
function ReceiptPage({ id }: { id: string }) {
  const params = useSearchParams();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<OrderResp>(`/api/orders/${id}`),
      api<{ settings: { cafeName: string } }>("/api/settings"),
    ])
      .then(([o, s]) => {
        setData({
          cafeName: s.settings.cafeName,
          code: o.order.code,
          tableName: o.order.table?.name ?? null,
          createdAt: o.order.createdAt,
          closedAt: o.order.closedAt,
          splitMode: o.order.splitMode,
          items: o.order.items,
          participants: o.order.participants,
          bill: o.bill,
          payments: o.order.payments,
        });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // ?print=1 → langsung buka dialog cetak (dipakai POS)
  useEffect(() => {
    if (data && params.get("print") === "1") setTimeout(() => window.print(), 300);
  }, [data, params]);

  if (error)
    return <p className="p-8 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  return (
    <div className="min-h-dvh bg-cream py-6">
      <div className="mx-auto w-fit rounded-xl bg-white shadow-md">
        <Receipt data={data} />
      </div>
      <div className="mx-auto mt-4 flex w-[300px] gap-2 print:hidden">
        <Button full onClick={() => window.print()}>
          <Printer size={18} /> Cetak
        </Button>
        <Button variant="teal" full onClick={() => window.print()}>
          <DownloadSimple size={18} /> Simpan PDF
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink/40 print:hidden">
        Di HP: pilih "Simpan sebagai PDF" pada dialog cetak.
      </p>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <ReceiptPage id={id} />
    </Suspense>
  );
}
