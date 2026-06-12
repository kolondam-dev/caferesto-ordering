"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MagnifyingGlass, Money as MoneyIcon, PicnicTable, Plus, Printer, Rectangle,
  Receipt as ReceiptIcon, SealCheck, WarningCircle,
} from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Money, PageTitle, Spinner } from "@/components/ui";
import MenuImage from "@/components/MenuImage";

const TableIcon = PicnicTable ?? Rectangle; // fallback bila ikon meja tak tersedia

type ValOrder = {
  id: string; code: string; splitMode: string | null;
  table?: { name: string } | null;
  items: { nameSnapshot: string; qty: number; status: string }[];
};

type AttnOrder = {
  id: string; code: string; lastActivityAt: string;
  table?: { name: string } | null;
  items: { status: string }[];
  participants: { name: string }[];
};

/** Reminder draft QR yang lama idle — kasir cek valid/tidaknya sebelum auto-expire (K4). */
function AttentionQueue() {
  const [orders, setOrders] = useState<AttnOrder[]>([]);
  const [ttl, setTtl] = useState(30);
  const [busy, setBusy] = useState("");

  const load = useCallback(
    () =>
      api<{ orders: AttnOrder[]; ttlMinutes: number }>("/api/orders?attention=1")
        .then((d) => {
          setOrders(d.orders);
          setTtl(d.ttlMinutes);
        })
        .catch(() => {}),
    []
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "extend" | "void") {
    setBusy(id);
    try {
      await api(`/api/orders/${id}/review`, { method: "POST", body: { action } });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (orders.length === 0) return null;
  return (
    <Card className="mb-4 border-gold-300 bg-gold-50 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 font-extrabold text-gold-900">
        <WarningCircle size={20} weight="fill" /> Perlu Perhatian ({orders.length}) — draft QR lama tidak aktif
      </h2>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((o) => {
          const idle = Math.floor((Date.now() - new Date(o.lastActivityAt).getTime()) / 60000);
          return (
            <div key={o.id} className="rounded-xl bg-white p-3">
              <p className="text-sm font-extrabold">
                {o.table?.name ?? "—"} · {o.code}
                <span className="ml-1.5 text-[10px] font-bold text-red-600">idle {idle} mnt (auto-expire {ttl} mnt)</span>
              </p>
              <p className="mt-0.5 text-xs text-ink/55">
                {o.participants.map((p) => p.name).join(", ") || "tanpa peserta"} · {o.items.filter((i) => i.status === "DRAFT").length} item draft
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="gold" className="flex-1 !py-1.5 text-xs" disabled={busy === o.id} onClick={() => act(o.id, "extend")}>
                  Masih Valid (+{ttl} mnt)
                </Button>
                <Button variant="outline" className="!py-1.5 text-xs" disabled={busy === o.id} onClick={() => act(o.id, "void")}>
                  Void
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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
type MenuItem = {
  id: string; name: string; price: number; available: boolean;
  photos?: { url: string; isPrimary: boolean }[];
};
type Category = { id: string; name: string; items: MenuItem[] };
type OrderData = {
  order: {
    id: string; code: string; status: string;
    table?: { name: string } | null;
    items: { id: string; nameSnapshot: string; price: number; qty: number; status: string }[];
  };
  bill: { subtotal: number; serviceFee: number; tax: number; total: number; settled: number; deposit: number; due: number };
};

/**
 * POS kasir — layout: strip meja horizontal di atas, lalu kolom menu (70%,
 * dengan chips kategori + pencarian) dan kolom kalkulasi order (30%).
 */
export default function POSPage() {
  const [tables, setTables] = useState<TableT[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [current, setCurrent] = useState<OrderData | null>(null);
  const [preview, setPreview] = useState<TableT | null>(null);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [printerReady, setPrinterReady] = useState(false);
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
    api<{ settings: { printerHost: string } }>("/api/settings")
      .then((d) => setPrinterReady(!!d.settings.printerHost))
      .catch(() => {});
  }, [loadTables]);

  const visibleItems = useMemo(() => {
    const cats = activeCat === "all" ? categories : categories.filter((c) => c.id === activeCat);
    const q = search.trim().toLowerCase();
    return cats.flatMap((c) =>
      c.items.filter((i) => i.available && (!q || i.name.toLowerCase().includes(q)))
    );
  }, [categories, activeCat, search]);

  // Klik meja hanya membuka pratinjau — order baru dibuat lewat tombol eksplisit.
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
      setPreview(null);
      await loadOrder(order.id);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(item: MenuItem) {
    if (!current || current.order.status !== "OPEN") return;
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

  async function printThermal() {
    if (!current) return;
    setBusy(true);
    try {
      await api("/api/print/receipt", { method: "POST", body: { orderId: current.order.id } });
      setMsg("Struk terkirim ke printer 🖨");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!tables) return <Spinner />;

  const TONE: Record<string, string> = {
    OPEN: "border-teal-200 bg-white text-teal-700",
    BOOKED: "border-gold-300 bg-gold-50 text-gold-800",
    OCCUPIED: "border-sunset-300 bg-sunset-50 text-sunset-800",
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageTitle title="POS Kasir" subtitle="Kelola order dine-in & takeaway" action={<Button variant="teal" onClick={openTakeaway} disabled={busy}><Plus size={16} /> Takeaway</Button>} />
      <ValidationQueue onChanged={loadTables} />
      <AttentionQueue />

      {/* Strip meja horizontal */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tables.map((t) => {
          const active = preview?.id === t.id || current?.order.table?.name === t.name;
          return (
            <button
              key={t.id}
              onClick={() => selectTable(t)}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                active ? "border-teal-600 bg-teal-600 text-white" : TONE[t.status] ?? "border-sunset-100 bg-white"
              }`}
            >
              <TableIcon size={20} weight={t.status === "OPEN" && !active ? "regular" : "fill"} />
              <span className="text-left">
                <span className="block text-xs font-extrabold leading-tight">{t.name}</span>
                <span className={`block text-[9px] leading-tight ${active ? "text-white/80" : "opacity-60"}`}>{t.status}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Menu 70% | kalkulasi 30% */}
      <div className="grid gap-4 lg:grid-cols-[7fr_3fr]">
        <Card className="p-3">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari menu…"
                className="w-full rounded-xl border border-sunset-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-400"
              />
            </div>
            {current && (
              <p className="text-xs font-bold text-ink/45">→ {current.order.code}</p>
            )}
          </div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <CatChip label="Semua" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
            {categories.map((c) => (
              <CatChip key={c.id} label={c.name} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
            ))}
          </div>
          <div className="grid max-h-[60dvh] grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((i) => (
              <button
                key={i.id}
                disabled={!current || current.order.status !== "OPEN"}
                onClick={() => addItem(i)}
                className="overflow-hidden rounded-xl border border-sunset-100 bg-white text-left transition-colors hover:border-teal-400 disabled:opacity-40"
              >
                <div className="h-20 w-full">
                  <MenuImage photos={i.photos} alt={i.name} />
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-sm font-bold leading-tight">{i.name}</p>
                  <Money value={i.price} className="text-xs font-bold text-teal-700" />
                </div>
              </button>
            ))}
            {visibleItems.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-ink/40">Tidak ada menu yang cocok.</p>
            )}
          </div>
        </Card>

        {/* Kalkulasi order */}
        <Card className="h-fit p-4">
          {preview ? (
            <div className="py-2">
              <h2 className="flex items-center gap-2 font-extrabold">
                <TableIcon size={22} weight="fill" className="text-teal-600" /> {preview.name}
              </h2>
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
                  <Button variant="teal" full onClick={() => continueOrder(preview)} disabled={busy}>
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
              {/* Struk: preview/cetak browser + thermal */}
              <div className="mt-3 space-y-2 border-t border-sunset-100 pt-3">
                <Button
                  variant="outline"
                  full
                  onClick={() => window.open(`/receipt/${current.order.id}?print=1`, "_blank")}
                >
                  <ReceiptIcon size={18} /> Preview & Cetak Struk
                </Button>
                {printerReady && (
                  <Button variant="secondary" full onClick={printThermal} disabled={busy}>
                    <Printer size={18} /> Cetak Thermal
                  </Button>
                )}
              </div>
              {msg && <p className="mt-2 text-sm font-semibold text-violet-700">{msg}</p>}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-teal-600 text-white" : "border border-sunset-100 bg-white text-ink/55 hover:border-teal-300"
      }`}
    >
      {label}
    </button>
  );
}
