"use client";

import { useCallback, useEffect, useState } from "react";
import { CookingPot, CheckCircle, Bell } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Empty, PageTitle, Spinner } from "@/components/ui";

type KItem = {
  id: string; nameSnapshot: string; qty: number; notes?: string; status: string; createdAt: string;
  order: { code: string; table?: { name: string } | null; type: string };
};

const COLUMNS = [
  { status: "QUEUED", label: "Antrian", icon: Bell, next: "PREPARING", action: "Mulai Masak", tone: "border-gold-300" },
  { status: "PREPARING", label: "Dimasak", icon: CookingPot, next: "READY", action: "Selesai", tone: "border-sunset-300" },
  { status: "READY", label: "Siap Antar", icon: CheckCircle, next: "SERVED", action: "Sudah Diantar", tone: "border-teal-300" },
];

/** Kitchen Display System — polling 4 detik. */
export default function KitchenPage() {
  const [items, setItems] = useState<KItem[] | null>(null);

  const load = useCallback(
    () => api<{ items: KItem[] }>("/api/kitchen").then((d) => setItems(d.items)).catch(() => {}),
    []
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function advance(id: string, status: string) {
    await api(`/api/order-items/${id}`, { method: "PATCH", body: { status } });
    load();
  }

  if (!items) return <Spinner />;

  const age = (s: string) => {
    const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
    return m < 1 ? "baru" : `${m} mnt`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Kitchen Display" subtitle="Antrian dapur real-time" />
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.status === col.status);
          const Icon = col.icon;
          return (
            <div key={col.status}>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold">
                <Icon size={18} weight="fill" className="text-sunset-500" />
                {col.label} <span className="text-ink/40">({colItems.length})</span>
              </h2>
              <div className="space-y-2">
                {colItems.length === 0 && <Empty text="Kosong" />}
                {colItems.map((i) => (
                  <Card key={i.id} className={`border-l-4 p-3 ${col.tone}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">
                          {i.qty}× {i.nameSnapshot}
                        </p>
                        <p className="text-xs text-ink/50">
                          {i.order.table?.name ?? "Takeaway"} · {i.order.code}
                        </p>
                        {i.notes && <p className="mt-0.5 text-xs italic text-violet-700">“{i.notes}”</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink/50">
                        {age(i.createdAt)}
                      </span>
                    </div>
                    <Button full className="mt-2 !py-1.5 text-xs" variant={col.status === "READY" ? "teal" : "primary"} onClick={() => advance(i.id, col.next)}>
                      {col.action}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
