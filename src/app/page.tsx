"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, ShoppingCartSimple, X } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Money, Spinner, Empty } from "@/components/ui";
import CustomerShell from "@/components/CustomerShell";

type MenuItem = { id: string; name: string; description?: string; price: number; available: boolean };
type Category = { id: string; name: string; items: MenuItem[] };
type TableT = { id: string; name: string; capacity: number; status: string };
type CartLine = { item: MenuItem; qty: number };

export default function HomePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [tables, setTables] = useState<TableT[]>([]);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [tableId, setTableId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories));
    api<{ tables: TableT[] }>("/api/tables").then((d) => setTables(d.tables)).catch(() => {});
  }, []);

  const lines = Object.values(cart);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const visibleItems = useMemo(() => {
    if (!categories) return [];
    const cats = activeCat === "all" ? categories : categories.filter((c) => c.id === activeCat);
    return cats.flatMap((c) => c.items.filter((i) => i.available).map((i) => ({ ...i, cat: c.name })));
  }, [categories, activeCat]);

  function add(item: MenuItem, delta: number) {
    setCart((c) => {
      const cur = c[item.id]?.qty ?? 0;
      const qty = cur + delta;
      const next = { ...c };
      if (qty <= 0) delete next[item.id];
      else next[item.id] = { item, qty };
      return next;
    });
  }

  async function checkout() {
    setError("");
    setSubmitting(true);
    try {
      const { user } = await api<{ user: unknown }>("/api/auth/me");
      if (!user) {
        router.push("/login?next=/");
        return;
      }
      const { order } = await api<{ order: { id: string } }>("/api/orders", {
        method: "POST",
        body: orderType === "DINE_IN" ? { type: "DINE_IN", tableId } : { type: "TAKEAWAY" },
      });
      await api(`/api/orders/${order.id}/items`, {
        method: "POST",
        body: { items: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })) },
      });
      setCart({});
      router.push(`/order/${order.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerShell>
      {/* Hero */}
      <div className="mb-4 rounded-2xl bg-gradient-to-r from-sunset-500 via-sunset-400 to-gold-400 p-5 text-white md:p-7">
        <h1 className="text-xl font-extrabold md:text-3xl">Pesan langsung dari meja Anda 🌅</h1>
        <p className="mt-1 text-sm text-white/90 md:text-base">
          <b>Scan QR di meja Anda</b> untuk pesan bareng teman tanpa login — atau telusuri menu di bawah.
        </p>
      </div>

      {/* Kategori */}
      {categories && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <CatChip label="Semua" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
          {categories.map((c) => (
            <CatChip key={c.id} label={c.name} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
          ))}
        </div>
      )}

      {!categories ? (
        <Spinner />
      ) : visibleItems.length === 0 ? (
        <Empty text="Belum ada menu tersedia" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => {
            const qty = cart[item.id]?.qty ?? 0;
            return (
              <Card key={item.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.name}</p>
                  {item.description && <p className="line-clamp-1 text-xs text-ink/50">{item.description}</p>}
                  <Money value={item.price} className="mt-1 block text-sm font-bold text-sunset-600" />
                </div>
                {qty === 0 ? (
                  <Button onClick={() => add(item, 1)} className="!px-3 shrink-0">
                    <Plus size={16} weight="bold" />
                  </Button>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" onClick={() => add(item, -1)} className="!px-2.5 !py-1.5">
                      <Minus size={14} weight="bold" />
                    </Button>
                    <span className="w-5 text-center font-bold">{qty}</span>
                    <Button onClick={() => add(item, 1)} className="!px-2.5 !py-1.5">
                      <Plus size={14} weight="bold" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Tombol keranjang melayang */}
      {count > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-violet-700 px-5 py-3.5 text-white shadow-xl md:bottom-6 md:left-auto md:right-6 md:w-80"
        >
          <span className="flex items-center gap-2 font-bold">
            <ShoppingCartSimple size={20} weight="fill" /> {count} item
          </span>
          <Money value={total} className="font-extrabold" />
        </button>
      )}

      {/* Drawer keranjang */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setCartOpen(false)}>
          <div
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 md:max-w-md md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Keranjang</h2>
              <button onClick={() => setCartOpen(false)} className="text-ink/40">
                <X size={22} />
              </button>
            </div>
            {lines.map((l) => (
              <div key={l.item.id} className="flex items-center justify-between border-b border-sunset-50 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{l.item.name}</p>
                  <Money value={l.item.price * l.qty} className="text-xs text-ink/50" />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => add(l.item, -1)} className="!px-2 !py-1">
                    <Minus size={12} weight="bold" />
                  </Button>
                  <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
                  <Button onClick={() => add(l.item, 1)} className="!px-2 !py-1">
                    <Plus size={12} weight="bold" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Button variant={orderType === "DINE_IN" ? "primary" : "outline"} onClick={() => setOrderType("DINE_IN")} className="flex-1">
                  Dine-in
                </Button>
                <Button variant={orderType === "TAKEAWAY" ? "primary" : "outline"} onClick={() => setOrderType("TAKEAWAY")} className="flex-1">
                  Takeaway
                </Button>
              </div>
              {orderType === "DINE_IN" && (
                <div className="grid grid-cols-4 gap-2">
                  {tables.map((t) => (
                    <button
                      key={t.id}
                      disabled={t.status !== "OPEN"}
                      onClick={() => setTableId(t.id)}
                      className={`rounded-xl border px-2 py-2 text-xs font-bold disabled:opacity-30 ${
                        tableId === t.id ? "border-sunset-500 bg-sunset-500 text-white" : "border-sunset-200 bg-white"
                      }`}
                    >
                      {t.name.replace("Meja ", "M")}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink/60">Subtotal (belum pajak)</span>
                <Money value={total} className="text-lg font-extrabold text-sunset-600" />
              </div>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button full disabled={submitting || (orderType === "DINE_IN" && !tableId)} onClick={checkout}>
                {submitting ? "Mengirim…" : "Kirim Pesanan ke Dapur"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${
        active ? "bg-violet-700 text-white" : "bg-white text-ink/60 border border-sunset-100"
      }`}
    >
      {label}
    </button>
  );
}
