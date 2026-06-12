"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Input, PageTitle, Spinner } from "@/components/ui";

type TableT = {
  id: string; number: number; name: string; capacity: number; status: string;
  bookings: { code: string; scheduledAt: string }[];
  orders: { code: string }[];
};

export default function TablesPage() {
  const [tables, setTables] = useState<TableT[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [num, setNum] = useState("");
  const [cap, setCap] = useState("4");

  const load = useCallback(
    () => api<{ tables: TableT[] }>("/api/tables").then((d) => setTables(d.tables)),
    []
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/tables", { method: "POST", body: { number: Number(num), capacity: Number(cap) } }).catch((err) => alert(err.message));
    setAdding(false);
    setNum("");
    load();
  }

  if (!tables) return <Spinner />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Meja"
        subtitle="Status meja live"
        action={
          <Button variant="gold" onClick={() => setAdding((v) => !v)}>
            <Plus size={16} /> Tambah
          </Button>
        }
      />
      {adding && (
        <Card className="mb-4 p-4">
          <form onSubmit={add} className="flex flex-wrap items-end gap-3">
            <div className="w-28">
              <label className="text-xs font-semibold text-ink/60">Nomor</label>
              <Input type="number" value={num} onChange={(e) => setNum(e.target.value)} required />
            </div>
            <div className="w-28">
              <label className="text-xs font-semibold text-ink/60">Kapasitas</label>
              <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)} required />
            </div>
            <Button type="submit">Simpan</Button>
          </form>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tables.map((t) => (
          <Card key={t.id} className={`p-4 text-center ${t.status === "OCCUPIED" ? "bg-sunset-50" : t.status === "BOOKED" ? "bg-gold-50" : ""}`}>
            <p className="text-lg font-extrabold">{t.name}</p>
            <p className="mb-2 flex items-center justify-center gap-1 text-xs text-ink/50">
              <Users size={12} /> {t.capacity} orang
            </p>
            <Badge status={t.status} />
            {t.bookings[0] && (
              <p className="mt-2 text-[10px] text-ink/40">
                Booking {new Date(t.bookings[0].scheduledAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {t.orders[0] && <p className="mt-1 text-[10px] font-semibold text-sunset-700">{t.orders[0].code}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
