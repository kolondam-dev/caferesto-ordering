"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CookingPot, MagnifyingGlass, Minus, Money as MoneyIcon, PicnicTable, Plus, Printer, Rectangle,
  Receipt as ReceiptIcon, SealCheck, WarningCircle,
} from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Input, Label, Money, PageTitle, Spinner } from "@/components/ui";
import MenuImage from "@/components/MenuImage";
import Sheet from "@/components/Sheet";
import { usePerms } from "@/lib/use-permissions";

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

type TableOrder = { id: string; code: string; status: string; createdAt: string; items: { status: string }[] };
type TableT = { id: string; name: string; capacity: number; status: string; orders: TableOrder[] };
type TakeawayOrder = {
  id: string; code: string; status: string; createdAt: string;
  customerName?: string | null; channel?: string | null;
  items: { status: string }[];
};

type TodayOrder = {
  id: string; code: string; type: string; status: string; createdAt: string;
  customerName?: string | null; channel?: string | null;
  table?: { name: string } | null;
  bill: { total: number };
};

const CHANNEL_LABEL: Record<string, string> = {
  WALKIN: "Walk-in", SHOPEEFOOD: "ShopeeFood", GOFOOD: "GoFood", WA: "WhatsApp",
};

function elapsedLabel(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru";
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  return `${h}j ${m % 60}m`;
}
type MenuItem = {
  id: string; name: string; price: number; available: boolean;
  photos?: { url: string; isPrimary: boolean }[];
};
type Category = { id: string; name: string; items: MenuItem[] };
type OrderItem = { id: string; menuItemId: string; nameSnapshot: string; price: number; qty: number; status: string };
type OrderData = {
  order: {
    id: string; code: string; status: string;
    table?: { name: string } | null;
    items: OrderItem[];
  };
  bill: { subtotal: number; serviceFee: number; tax: number; total: number; settled: number; deposit: number; due: number };
};

/**
 * POS kasir — layout: strip meja horizontal di atas, lalu kolom menu (70%,
 * dengan chips kategori + pencarian) dan kolom kalkulasi order (30%).
 */
export default function POSPage() {
  const { can } = usePerms();
  const canCancel = can("pos.cancel_order");
  const [tables, setTables] = useState<TableT[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [current, setCurrent] = useState<OrderData | null>(null);
  const [preview, setPreview] = useState<TableT | null>(null);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [menuTab, setMenuTab] = useState<"order" | "stock" | "history">("order");
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [boardMode, setBoardMode] = useState<"dinein" | "takeaway">("dinein");
  const [takeaways, setTakeaways] = useState<TakeawayOrder[]>([]);
  const [newTakeawayOpen, setNewTakeawayOpen] = useState(false);
  const [printerReady, setPrinterReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadMenu = useCallback(
    () => api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories)),
    []
  );
  const loadTables = useCallback(
    () => api<{ tables: TableT[] }>("/api/tables").then((d) => setTables(d.tables)),
    []
  );
  const loadTakeaways = useCallback(
    () => api<{ orders: TakeawayOrder[] }>("/api/orders?board=takeaway").then((d) => setTakeaways(d.orders)).catch(() => {}),
    []
  );
  const loadTodayHistory = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    return api<{ orders: TodayOrder[] }>(`/api/orders/history?type=ALL&from=${today}&to=${today}`)
      .then((d) => setTodayOrders(d.orders))
      .catch(() => {});
  }, []);
  const loadOrder = useCallback(async (orderId: string) => {
    setCurrent(await api<OrderData>(`/api/orders/${orderId}`));
  }, []);

  useEffect(() => {
    loadTables();
    loadMenu();
    loadTakeaways();
    api<{ settings: { printerHost: string } }>("/api/settings")
      .then((d) => setPrinterReady(!!d.settings.printerHost))
      .catch(() => {});
  }, [loadTables, loadMenu, loadTakeaways]);

  // Refresh strip meja & papan takeaway berkala (status & progres penyajian)
  useEffect(() => {
    const t = setInterval(() => {
      loadTables();
      loadTakeaways();
    }, 10000);
    return () => clearInterval(t);
  }, [loadTables, loadTakeaways]);

  // Order lunas yang menunggu dibersihkan: pantau progres penyajian live
  const currentId = current?.order.id;
  const currentStatus = current?.order.status;
  useEffect(() => {
    if (!currentId || currentStatus === "OPEN") return;
    const t = setInterval(() => loadOrder(currentId), 6000);
    return () => clearInterval(t);
  }, [currentId, currentStatus, loadOrder]);

  // Muat riwayat hari ini saat tab Riwayat dibuka
  useEffect(() => {
    if (menuTab === "history") loadTodayHistory();
  }, [menuTab, loadTodayHistory]);

  // Pratinjau meja selalu pakai data tabel terbaru (bukan snapshot saat klik)
  const previewLive = preview ? tables?.find((t) => t.id === preview.id) ?? preview : null;

  const visibleItems = useMemo(() => {
    const cats = activeCat === "all" ? categories : categories.filter((c) => c.id === activeCat);
    const q = search.trim().toLowerCase();
    // Mode pesan: hanya menu tersedia. Mode stok: tampilkan semua (untuk di-toggle).
    return cats
      .flatMap((c) => c.items.filter((i) => !q || i.name.toLowerCase().includes(q)))
      .filter((i) => menuTab === "stock" || i.available);
  }, [categories, activeCat, search, menuTab]);

  // Qty menu tertentu yang ada di order berjalan (untuk counter di kartu)
  const qtyOf = useCallback(
    (menuItemId: string) =>
      (current?.order.items ?? [])
        .filter((i) => i.menuItemId === menuItemId && i.status !== "CANCELED")
        .reduce((s, i) => s + i.qty, 0),
    [current]
  );
  const hasUnsent = (current?.order.items ?? []).some((i) => i.status === "DRAFT");

  // Klik meja hanya membuka pratinjau — order baru dibuat lewat tombol eksplisit.
  function selectTable(t: TableT) {
    setMsg("");
    setPreview(t);
  }

  async function continueOrder(orderId: string) {
    setPreview(null);
    await loadOrder(orderId);
  }

  /** Kasir membebaskan meja setelah memastikan semua pesanan tersaji. */
  async function clearTable(orderId: string, allServed: boolean) {
    if (!allServed && !confirm("Masih ada pesanan yang belum tersaji. Tetap bersihkan meja?")) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/orders/${orderId}/clear-table`, { method: "POST" });
      setPreview(null);
      setCurrent(null);
      loadTables();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
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

  async function createTakeaway(payload: { customerName: string; customerPhone: string; channel: string }) {
    setBusy(true);
    try {
      const { order } = await api<{ order: { id: string } }>("/api/orders", {
        method: "POST",
        body: { type: "TAKEAWAY", ...payload },
      });
      setNewTakeawayOpen(false);
      setPreview(null);
      await loadOrder(order.id);
      loadTakeaways();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(item: MenuItem) {
    if (!current || current.order.status !== "OPEN" || !item.available) return;
    await api(`/api/orders/${current.order.id}/items`, { method: "POST", body: { items: [{ menuItemId: item.id, qty: 1 }] } });
    loadOrder(current.order.id);
  }

  /** Kurangi 1: cari item DRAFT (belum dikirim) dengan menu yang sama, decrement/hapus. */
  async function removeItem(menuItemId: string) {
    if (!current) return;
    const draft = [...current.order.items].reverse().find((i) => i.menuItemId === menuItemId && i.status === "DRAFT");
    if (!draft) return; // item yang sudah dikirim dapur tidak bisa dikurangi di sini
    if (draft.qty > 1) await api(`/api/order-items/${draft.id}`, { method: "PATCH", body: { qty: draft.qty - 1 } });
    else await api(`/api/order-items/${draft.id}`, { method: "DELETE" });
    loadOrder(current.order.id);
  }

  async function sendKitchen() {
    if (!current) return;
    setBusy(true);
    setMsg("");
    try {
      const { sent } = await api<{ sent: number }>(`/api/orders/${current.order.id}/send-kitchen`, { method: "POST" });
      await loadOrder(current.order.id);
      setMsg(sent > 0 ? `${sent} item dikirim ke dapur 🍳` : "Tidak ada item baru untuk dikirim");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStock(item: MenuItem) {
    await api(`/api/menu/${item.id}/availability`, { method: "PATCH", body: { available: !item.available } });
    loadMenu();
  }

  async function pay(method: "cash" | "gateway") {
    if (!current) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/orders/${current.order.id}/pay`, { method: "POST", body: { method } });
      await loadOrder(current.order.id);
      loadTables();
      loadTakeaways();
      setMsg("Pembayaran berhasil ✅");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!current || !confirm("Batalkan order ini?")) return;
    const res = await api<{ ok?: boolean; pending?: boolean; message?: string }>(
      `/api/orders/${current.order.id}`,
      { method: "PATCH", body: { action: "cancel" } }
    ).catch((e) => { alert((e as Error).message); return null; });
    if (!res) return;
    if (res.pending) {
      // Bukan owner: pembatalan menunggu persetujuan; order tetap berjalan.
      alert(res.message ?? "Permintaan pembatalan menunggu persetujuan owner.");
      return;
    }
    setCurrent(null);
    loadTables();
    loadTakeaways();
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
      <PageTitle
        title="POS Kasir"
        subtitle="Kelola order dine-in & takeaway"
        action={
          <div className="flex gap-1.5 rounded-xl bg-cream p-1">
            <button
              onClick={() => { setBoardMode("dinein"); setMsg(""); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${boardMode === "dinein" ? "bg-teal-600 text-white" : "text-ink/55"}`}
            >
              Dine-in
            </button>
            <button
              onClick={() => { setBoardMode("takeaway"); setMsg(""); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${boardMode === "takeaway" ? "bg-teal-600 text-white" : "text-ink/55"}`}
            >
              Takeaway
            </button>
          </div>
        }
      />
      <ValidationQueue onChanged={loadTables} />
      <AttentionQueue />

      {/* Strip: meja (dine-in) atau papan takeaway */}
      {boardMode === "dinein" ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tables.map((t) => {
            const active = preview?.id === t.id || current?.order.table?.name === t.name;
            const ord = t.orders[0];
            const occupied = t.status === "OCCUPIED";
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
                  <span className={`block text-[9px] leading-tight ${active ? "text-white/80" : "opacity-60"}`}>
                    {occupied && ord ? `${ord.status === "PAID" ? "lunas" : "isi"} · ${elapsedLabel(ord.createdAt)}` : t.status}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setNewTakeawayOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-teal-400 px-3 py-2 text-sm font-bold text-teal-700"
          >
            <Plus size={18} weight="bold" /> Takeaway Baru
          </button>
          {takeaways.map((o) => {
            const active = current?.order.id === o.id;
            const served = o.items.filter((i) => i.status === "SERVED").length;
            const total = o.items.filter((i) => i.status !== "CANCELED").length;
            return (
              <button
                key={o.id}
                onClick={() => { setPreview(null); loadOrder(o.id); }}
                className={`flex shrink-0 flex-col items-start rounded-xl border px-3 py-2 transition-colors ${
                  active ? "border-teal-600 bg-teal-600 text-white" : "border-sunset-200 bg-white"
                }`}
              >
                <span className="text-xs font-extrabold leading-tight">{o.customerName || o.code}</span>
                <span className={`text-[9px] leading-tight ${active ? "text-white/80" : "text-ink/50"}`}>
                  {CHANNEL_LABEL[o.channel ?? "WALKIN"] ?? o.channel} · {o.status === "PAID" ? `lunas ${served}/${total}` : "berjalan"} · {elapsedLabel(o.createdAt)}
                </span>
              </button>
            );
          })}
          {takeaways.length === 0 && (
            <span className="flex items-center px-2 text-xs text-ink/40">Belum ada takeaway aktif.</span>
          )}
        </div>
      )}

      {/* Menu 70% | kalkulasi 30% */}
      <div className="grid gap-4 lg:grid-cols-[7fr_3fr]">
        <Card className="p-3">
          {/* Tab: Pesan / Stok / Riwayat hari ini */}
          <div className="mb-2 flex gap-1.5">
            <TabBtn active={menuTab === "order"} onClick={() => setMenuTab("order")}>Pesan</TabBtn>
            <TabBtn active={menuTab === "stock"} onClick={() => setMenuTab("stock")}>Stok Menu</TabBtn>
            <TabBtn active={menuTab === "history"} onClick={() => setMenuTab("history")}>Riwayat</TabBtn>
          </div>

          {menuTab === "history" ? (
            <div className="max-h-[62dvh] divide-y divide-sunset-50 overflow-y-auto">
              <p className="px-1 pb-2 text-xs text-ink/50">
                Order hari ini ({todayOrders.length}) — klik untuk lihat detail.
              </p>
              {todayOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => { setPreview(null); loadOrder(o.id); }}
                  className={`flex w-full items-center justify-between gap-2 px-2 py-2 text-left transition-colors ${
                    current?.order.id === o.id ? "bg-teal-50" : "hover:bg-sunset-50/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {o.code}
                      <span className="ml-1.5 font-normal text-ink/50">
                        {o.table?.name ?? (o.channel ? CHANNEL_LABEL[o.channel] : "Takeaway")}
                        {o.customerName ? ` · ${o.customerName}` : ""}
                      </span>
                    </p>
                    <p className="text-[10px] text-ink/45">
                      {new Date(o.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {o.type === "TAKEAWAY" ? "Takeaway" : "Dine-in"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Money value={o.bill.total} className="text-sm font-bold" />
                    <Badge status={o.status} />
                  </div>
                </button>
              ))}
              {todayOrders.length === 0 && (
                <p className="py-8 text-center text-sm text-ink/40">Belum ada order hari ini.</p>
              )}
            </div>
          ) : (
          <>
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
            {menuTab === "order" && current && (
              <p className="text-xs font-bold text-ink/45">→ {current.order.code}</p>
            )}
          </div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <CatChip label="Semua" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
            {categories.map((c) => (
              <CatChip key={c.id} label={c.name} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
            ))}
          </div>
          {menuTab === "order" && !current && (
            <p className="mb-2 rounded-xl bg-cream px-3 py-2 text-xs text-ink/50">
              Pilih meja & buka order untuk mulai menambah item.
            </p>
          )}
          <div className="grid max-h-[58dvh] grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((i) => {
              const qty = qtyOf(i.id);
              const canOrder = !!current && current.order.status === "OPEN";
              return (
                <div
                  key={i.id}
                  className={`relative overflow-hidden rounded-xl border bg-white ${
                    qty > 0 ? "border-teal-400" : "border-sunset-100"
                  } ${menuTab === "stock" && !i.available ? "opacity-60" : ""}`}
                >
                  <button
                    type="button"
                    disabled={menuTab !== "order" || !canOrder || !i.available}
                    onClick={() => addItem(i)}
                    className="block w-full text-left disabled:cursor-default"
                  >
                    <div className="relative h-20 w-full overflow-hidden">
                      <MenuImage photos={i.photos} alt={i.name} />
                      {!i.available && <span className="soldout-ribbon">SOLD OUT</span>}
                      {menuTab === "order" && qty > 0 && (
                        <span className="absolute right-1 top-1 rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-extrabold text-white shadow">
                          {qty}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-sm font-bold leading-tight">{i.name}</p>
                      <Money value={i.price} className="text-xs font-bold text-teal-700" />
                    </div>
                  </button>

                  {/* Mode pesan: tombol +/- */}
                  {menuTab === "order" && canOrder && i.available && (
                    <div className="flex items-center justify-end gap-1.5 border-t border-sunset-50 px-2 py-1.5">
                      {qty > 0 && (
                        <button
                          onClick={() => removeItem(i.id)}
                          aria-label={`Kurangi ${i.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-sunset-500/15 text-sunset-700 active:bg-sunset-500/30"
                        >
                          <Minus size={15} weight="bold" />
                        </button>
                      )}
                      <button
                        onClick={() => addItem(i)}
                        aria-label={`Tambah ${i.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600/15 text-teal-700 active:bg-teal-600/30"
                      >
                        <Plus size={15} weight="bold" />
                      </button>
                    </div>
                  )}

                  {/* Mode stok: toggle sold out / ready */}
                  {menuTab === "stock" && (
                    <div className="border-t border-sunset-50 p-1.5">
                      <Button
                        variant={i.available ? "outline" : "teal"}
                        full
                        className="!py-1.5 text-xs"
                        onClick={() => toggleStock(i)}
                      >
                        {i.available ? "Jadikan Habis" : "Jadikan Tersedia"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-ink/40">Tidak ada menu yang cocok.</p>
            )}
          </div>
          </>
          )}
        </Card>

        {/* Kalkulasi order */}
        <Card className="h-fit p-4">
          {previewLive ? (
            <div className="py-2">
              <h2 className="flex items-center gap-2 font-extrabold">
                <TableIcon size={22} weight="fill" className="text-teal-600" /> {previewLive.name}
              </h2>
              <p className="mt-0.5 text-sm text-ink/55">
                Status: <Badge status={previewLive.status} /> · kapasitas {previewLive.capacity}
              </p>
              {previewLive.status === "BOOKED" && (
                <p className="mt-2 rounded-xl bg-gold-50 p-2.5 text-xs text-gold-900">
                  Meja ini sedang dibooking — buka order hanya bila tamu booking sudah datang.
                </p>
              )}
              {(() => {
                const active = previewLive.orders[0];
                const openOrder = active?.status === "OPEN" ? active : null;
                const paidOrder = active?.status === "PAID" ? active : null;
                const served = paidOrder ? paidOrder.items.filter((i) => i.status === "SERVED").length : 0;
                const total = paidOrder ? paidOrder.items.filter((i) => i.status !== "CANCELED").length : 0;
                const allServed = total > 0 && served === total;
                return (
                  <div className="mt-4 space-y-2">
                    {openOrder ? (
                      <Button variant="teal" full onClick={() => continueOrder(openOrder.id)} disabled={busy}>
                        Lanjutkan Order Berjalan
                      </Button>
                    ) : paidOrder ? (
                      <>
                        <div className={`rounded-xl p-2.5 text-center text-xs font-semibold ${allServed ? "bg-emerald-50 text-emerald-800" : "bg-gold-50 text-gold-900"}`}>
                          Lunas · {served}/{total} pesanan tersaji
                          {!allServed && " — tunggu semua diantar"}
                        </div>
                        <Button variant={allServed ? "teal" : "outline"} full onClick={() => clearTable(paidOrder.id, allServed)} disabled={busy}>
                          Bersihkan Meja
                        </Button>
                        <Button full onClick={() => openNewOrder(previewLive)} disabled={busy}>
                          <Plus size={16} /> Order Lagi (ronde baru)
                        </Button>
                      </>
                    ) : (
                      <Button full onClick={() => openNewOrder(previewLive)} disabled={busy}>
                        Buka Order Baru
                      </Button>
                    )}
                    <Button variant="outline" full onClick={() => setPreview(null)}>
                      Batal
                    </Button>
                  </div>
                );
              })()}
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
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {current.order.items.filter((i) => i.status !== "CANCELED").map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      {i.qty}× {i.nameSnapshot}
                      {i.status === "DRAFT" ? (
                        <span className="shrink-0 rounded-full bg-gold-100 px-1.5 text-[9px] font-bold text-gold-800">baru</span>
                      ) : (
                        <Badge status={i.status} />
                      )}
                    </span>
                    <Money value={i.price * i.qty} className="shrink-0 font-semibold" />
                  </div>
                ))}
              </div>
              {/* Langkah validasi: kirim item baru ke dapur */}
              {current.order.status === "OPEN" && hasUnsent && (
                <Button variant="teal" full className="mt-2" onClick={sendKitchen} disabled={busy}>
                  <CookingPot size={18} /> Kirim ke Dapur
                </Button>
              )}
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
                  {canCancel && (
                    <Button variant="outline" full onClick={cancelOrder} disabled={busy}>
                      Batalkan Order
                    </Button>
                  )}
                </div>
              )}
              {/* Lunas tapi meja belum dibersihkan: verifikasi penyajian lalu bebaskan meja */}
              {current.order.status === "PAID" && current.order.table && (() => {
                const active = current.order.items.filter((i) => i.status !== "CANCELED");
                const served = active.filter((i) => i.status === "SERVED").length;
                const allServed = active.length > 0 && served === active.length;
                return (
                  <div className="mt-3 space-y-2">
                    <div className={`rounded-xl p-2.5 text-center text-xs font-semibold ${allServed ? "bg-emerald-50 text-emerald-800" : "bg-gold-50 text-gold-900"}`}>
                      Lunas · {served}/{active.length} pesanan tersaji
                      {!allServed && " — tunggu semua diantar sebelum bersihkan"}
                    </div>
                    <Button variant={allServed ? "teal" : "outline"} full onClick={() => clearTable(current.order.id, allServed)} disabled={busy}>
                      Bersihkan Meja
                    </Button>
                  </div>
                );
              })()}
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

      {newTakeawayOpen && <NewTakeawaySheet busy={busy} onClose={() => setNewTakeawayOpen(false)} onCreate={createTakeaway} />}
    </div>
  );
}

function NewTakeawaySheet({
  busy, onClose, onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (p: { customerName: string; customerPhone: string; channel: string }) => void;
}) {
  const [customerName, setName] = useState("");
  const [customerPhone, setPhone] = useState("");
  const [channel, setChannel] = useState("WALKIN");
  const channels = [
    { v: "WALKIN", label: "Walk-in" },
    { v: "SHOPEEFOOD", label: "ShopeeFood" },
    { v: "GOFOOD", label: "GoFood" },
    { v: "WA", label: "WhatsApp" },
  ];
  return (
    <Sheet title="Takeaway Baru" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ customerName, customerPhone, channel });
        }}
        className="space-y-3"
      >
        <div>
          <Label>Nama pemesan</Label>
          <Input value={customerName} onChange={(e) => setName(e.target.value)} required placeholder="cth. Budi" autoFocus />
        </div>
        <div>
          <Label>No. HP (opsional)</Label>
          <Input value={customerPhone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="numeric" />
        </div>
        <div>
          <Label>Saluran</Label>
          <div className="grid grid-cols-2 gap-2">
            {channels.map((c) => (
              <button
                type="button"
                key={c.v}
                onClick={() => setChannel(c.v)}
                className={`rounded-xl border-2 py-2 text-sm font-bold ${
                  channel === c.v ? "border-teal-500 bg-teal-50 text-teal-800" : "border-sunset-100 bg-white text-ink/60"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="teal" full disabled={busy || !customerName.trim()}>
          {busy ? "Membuat…" : "Buat Order Takeaway"}
        </Button>
      </form>
    </Sheet>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
        active ? "bg-teal-600 text-white" : "bg-cream text-ink/55 hover:text-ink"
      }`}
    >
      {children}
    </button>
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
