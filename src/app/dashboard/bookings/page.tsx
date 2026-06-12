"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Empty, Money, PageTitle, Spinner } from "@/components/ui";

type Booking = {
  id: string; code: string; status: string; partySize: number; scheduledAt: string;
  payDeadlineAt: string; feeAmount: number; feePaidAt?: string; canceledReason?: string;
  table: { name: string }; customer: { name: string; email: string };
  order?: { code: string; status: string } | null;
};

export default function BookingsAdminPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(
    () => api<{ bookings: Booking[] }>("/api/bookings").then((d) => setBookings(d.bookings)),
    []
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Batalkan booking ini?")) return;
    await api(`/api/bookings/${id}`, { method: "PATCH", body: { action: "cancel", reason: "Dibatalkan oleh staff" } });
    load();
  }

  if (!bookings) return <Spinner />;
  const statuses = ["ALL", "PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELED", "EXPIRED"];
  const shown = filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);
  const fmt = (s: string) =>
    new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Booking" subtitle="Semua reservasi meja" />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${filter === s ? "bg-violet-700 text-white" : "bg-white text-ink/50 border border-sunset-100"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty text="Tidak ada booking" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">
                    {b.customer.name} · {b.table.name}
                  </p>
                  <p className="text-sm text-ink/60">
                    {fmt(b.scheduledAt)} · {b.partySize} orang
                  </p>
                  <p className="text-[11px] text-ink/40">{b.code} · {b.customer.email}</p>
                </div>
                <Badge status={b.status} />
              </div>
              <div className="mt-2 text-xs text-ink/60">
                Fee <Money value={b.feeAmount} className="font-semibold" /> ·{" "}
                {b.feePaidAt ? <span className="font-semibold text-emerald-700">dibayar {fmt(b.feePaidAt)}</span> : <>batas bayar <b>{fmt(b.payDeadlineAt)}</b></>}
                {b.order && <> · Order {b.order.code} ({b.order.status})</>}
              </div>
              {b.canceledReason && <p className="mt-1 text-xs text-red-600">{b.canceledReason}</p>}
              {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                <Button variant="outline" className="mt-2 !py-1.5 text-xs" onClick={() => cancel(b.id)}>
                  Batalkan
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
