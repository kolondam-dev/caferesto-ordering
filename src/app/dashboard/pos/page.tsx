"use client";

import { useCallback, useEffect, useState } from "react";
import { Money as MoneyIcon, Plus, SealCheck } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Money, PageTitle, Spinner } from "@/components/ui";

type ValOrder = {
  id: string; code: string; splitMode: string | null;
  table?: { name: string } | null;
  items: { nameSnapshot: string; qty: number; status: string }[];
};

/** Antrian validasi order QR yang sudah lunas (Scan & Serve). */
function ValidationQueue({ onChanged }: { onChanged: () => void }) {
  const [orders, setOrders] = useState<ValOrder[]>([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(
    () =>
      api<{ orders: ValOrder[] }>("/api/orders?status=AWAITING_VALIDATION")
        .then((d) => setOrders(d.orders))
        .catch(() => {}),
    []
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "approve" | "void") {
    if (action === "void" && !confirm("Void order ini? Refund pembayaran ditangani manual.")) return;
    setBusy(id);
    try {
      await api(`/api/orders/${id}/validate`, { method: "POST", body: { action } });
      load();
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (orders.length === 0) return null;
  return (
    <Card className="mb-4 border-teal-300 bg-teal-50 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 font-extrabold text-teal-900">
        <SealCheck size={20} weight="fill" /> Perlu Validasi ({orders.length}) — order QR sudah dibayar
      </h2>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl bg-white p-3">
            <p className="text-sm font-extrabold">
              {o.table?.name ?? "—"} · {o.code}
              <span className="ml-1.5 text-[10px] font-bold text-violet-700">{o.splitMode === "UPFRONT" ? "SPLIT MUKA" : "SPLIT AKHIR"}</span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink/55">
              {o.items.filter((i) => i.status !== "CANCELED").map((i) => `${i.qty}× ${i.nameSnapshot}`).join(", ")}
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="teal" className="flex-1 !py-1.5 text-xs" disabled={busy === o.id} onClick={() => act(o.id, "approve")}>
                Validasi → Dapur
              </Button>
              <Button variant="outline" className="!py-1.5 text-xs" disabled={busy === o.id} onClick={() => act(o.id, "void")}>
                Void
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

type TableT = { id: string; name: string; capacity: number; status: string; orders: { id: string }[] };
type MenuItem = { id: string; name: string; price: number; available: boolean };
type Category = { id: string; name: string; items: MenuItem[] };
type OrderData = {
  order: {
    id: string; code: string; status: string;
    table?: { name: string } | null;
    items: { id: string; nameSnapshot: string; price: number; qty: number; status: string }[];
  };
  bill: { subtotal: number; serviceFee: number; tax: number; total: number; settled: number; deposit: number; due: number };
};

/** POS kasir: pilih meja → tambah item → bayar cash / gateway. */
export default function POSPage() {
  const [tables, setTables] = useState<TableT[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [current, setCurrent] = useState<OrderData | null>(null);
  const [preview, setPreview] = useState<TableT | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadTables = useCallback(
    () => api<{ tables: TableT[] }>("/api/tables").then((d) => setTables(d.tables)),
    []
  );
  const loadOrder = useCallback(async (orderId: string) => {
    setCurrent(await api<OrderData>(`/api/orders/${orderId}`));
  }, []);

  useEffect(() => {
    loadTables();
    api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories));
  }, [loadTables]);

  // Klik meja hanya membuka pratinjau — order baru dibuat lewat tombol eksplisit,
  // mencegah order tak sengaja saat berpindah-pindah meja.
  function selectTable(t: TableT) {
    setMsg("");
    setPreview(t);
  }

  async function continueOrder(t: TableT) {
    setPreview(null);
    await loadOrder(t.orders[0].id);
  }

  async function openNewOrder(t: TableT) {
    setBusy(true);
    try {
      const { order } = await api<{ order: { id: string } }>("/api/orders", {
        method: "POST",
        body: { type: "DINE_IN", tableId: t.id },
      });
      setPreview(null);
      await loadOrder(order.id);
      loadTables();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openTakeaway() {
    setBusy(true);
    try {
      const { order } = await api<{ order: { id: string } }>("/api/orders", { method: "POST", body: { type: "TAKEAWAY" } });
      await loadOrder(order.id);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(item: MenuItem) {
    if (!current) return;
    await api(`/api/orders/${current.order.id}/items`, { method: "POST", body: { items: [{ menuItemId: item.id, qty: 1 }] } });
    loadOrder(current.order.id);
  }

  async function pay(method: "cash" | "gateway") {
    if (!current) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/orders/${current.order.id}/pay`, { method: "POST", body: { method } });
      await loadOrder(current.order.id);
      loadTables();
      setMsg("Pembayaran berhasil ✅");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!current || !confirm("Batalkan order ini?")) return;
    await api(`/api/orders/${current.order.id}`, { method: "PATCH", body: { action: "cancel" } });
    setCurrent(null);
    loadTables();
  }

  if (!tables) return <Spinner />;

  return (
    <div className="mx-auto max-w-7xl">
      <PageTitle title="POS Kasir" subtitle="Kelola order dine-in & takeaway" action={<Button variant="gold" onClick={openTakeaway} disabled={busy}><Plus size={16} /> Takeaway</Button>} />
      <ValidationQueue onChanged={loadTables} />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_340px]">
        {/* Meja */}
        <Card className="p-3">
          <h2 className="mb-2 px-1 text-sm font-extrabold">Meja</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTable(t)}
                className={`rounded-xl border p-2 text-center transition-colors ${
                  preview?.id === t.id || current?.order.table?.name === t.name
                    ? "border-sunset-500 bg-sunset-500 text-white"
                    : t.status === "OCCUPIED"
                      ? "border-sunset-200 bg-sunset-50"
                      : t.status === "BOOKED"
                        ? "border-gold-200 bg-gold-50"
                        : "border-sunset-100 bg-white"
                }`}
              >
                <p className="text-xs font-bold">{t.name.replace("Meja ", "M")}</p>
                <p className="text-[9px] opacity-60">{t.status}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Menu cepat */}
        <Card className="max-h-[70dvh] overflow-y-auto p-3">
          <h2 className="mb-2 px-1 text-sm font-extrabold">Menu {current ? `→ ${current.order.code}` : "(pilih meja dulu)"}</h2>
          {categories.map((c) => (
            <div key={c.id} className="mb-3">
              <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-ink/40">{c.name}</p>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                {c.items.filter((i) => i.available).map((i) => (
                  <button
                    key={i.id}
                    disabled={!current || current.order.status !== "OPEN"}
                    onClick={() => addItem(i)}
                    className="rounded-xl border border-sunset-100 bg-white p-2.5 text-left hover:border-sunset-400 disabled:opacity-40"
                  >
                    <p className="line-clamp-1 text-xs font-bold">{i.name}</p>
                    <Money value={i.price} className="text-[11px] text-sunset-600" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Card>

        {/* Order berjalan */}
        <Card className="p-4">
          {preview ? (
            <div className="py-4">
              <h2 className="font-extrabold">{preview.name}</h2>
              <p className="mt-0.5 text-sm text-ink/55">
                Status: <Badge status={preview.status} /> · kapasitas {preview.capacity}
              </p>
              {preview.status === "BOOKED" && (
                <p className="mt-2 rounded-xl bg-gold-50 p-2.5 text-xs text-gold-900">
                  Meja ini sedang dibooking — buka order hanya bila tamu booking sudah datang.
                </p>
              )}
              <div className="mt-4 space-y-2">
                {preview.orders[0] ? (
                  <Button full onClick={() => continueOrder(preview)} disabled={busy}>
                    Lanjutkan Order Berjalan
                  </Button>
                ) : (
                  <Button full onClick={() => openNewOrder(preview)} disabled={busy}>
                    Buka Order Baru
                  </Button>
                )}
                <Button variant="outline" full onClick={() => setPreview(null)}>
                  Batal
                </Button>
              </div>
              {msg && <p className="mt-2 text-sm font-semibold text-red-600">{msg}</p>}
            </div>
          ) : !current ? (
            <p className="py-10 text-center text-sm text-ink/40">Pilih meja atau buat takeaway untuk mulai.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-extrabold">
                  {current.order.code}
                  <span className="ml-2 text-xs font-semibold text-ink/40">{current.order.table?.name ?? "Takeaway"}</span>
                </h2>
                <Badge status={current.order.status} />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {current.order.items.filter((i) => i.status !== "CANCELED").map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {i.qty}× {i.nameSnapshot} <Badge status={i.status} />
                    </span>
                    <Money value={i.price * i.qty} className="shrink-0 font-semibold" />
                  </div>
                ))}
              </div>
              <div className="my-3 border-t border-dashed border-sunset-200" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-ink/50">Subtotal</span><Money value={current.bill.subtotal} /></div>
                {current.bill.serviceFee > 0 && (
                  <div className="flex justify-between"><span className="text-ink/50">Service fee</span><Money value={current.bill.serviceFee} /></div>
                )}
                <div className="flex justify-between"><span className="text-ink/50">Pajak</span><Money value={current.bill.tax} /></div>
                {current.bill.deposit > 0 && <div className="flex justify-between text-teal-600"><span>Deposit booking</span><Money value={-current.bill.deposit} /></div>}
                {current.bill.settled > 0 && <div className="flex justify-between text-teal-600"><span>Terbayar</span><Money value={-current.bill.settled} /></div>}
                <div className="flex justify-between text-base font-extrabold"><span>Sisa</span><Money value={current.bill.due} className="text-sunset-600" /></div>
              </div>
              {current.order.status === "OPEN" && (
                <div className="mt-3 space-y-2">
                  <Button full onClick={() => pay("cash")} disabled={busy || current.bill.due <= 0}>
                    <MoneyIcon size={18} /> Bayar Cash
                  </Button>
                  <Button variant="teal" full onClick={() => pay("gateway")} disabled={busy || current.bill.due <= 0}>
                    QRIS / Gateway
                  </Button>
                  <Button variant="outline" full onClick={cancelOrder} disabled={busy}>
                    Batalkan Order
                  </Button>
                </div>
              )}
              {msg && <p className="mt-2 text-sm font-semibold text-violet-700">{msg}</p>}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
