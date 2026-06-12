"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Minus, Plus, Trash, WhatsappLogo, X } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Money, Spinner } from "@/components/ui";

type Participant = { id: string; name: string; isHost: boolean };
type Item = {
  id: string; nameSnapshot: string; price: number; qty: number; status: string;
  participantId: string | null;
};
type OrderData = {
  order: {
    id: string; code: string; status: string; source: string;
    table?: { name: string; code: string | null } | null;
    items: Item[];
    participants: Participant[];
  };
  bill: { subtotal: number; tax: number; total: number; due: number };
  me: { participantId: string; isHost: boolean } | null;
};
type MenuItemT = { id: string; name: string; price: number; available: boolean; description?: string };
type Category = { id: string; name: string; items: MenuItemT[] };

/** Halaman order kolaboratif jalur QR — draft bersama multi-peserta. */
export default function CollabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(() => {
    api<OrderData>(`/api/orders/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3500); // sinkronisasi antar peserta
    return () => clearInterval(t);
  }, [load]);

  if (error && !data)
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-sm text-red-600">{error} — coba scan ulang QR di meja Anda.</p>
      </div>
    );
  if (!data) return <Spinner />;

  const { order, bill, me } = data;
  const isDraft = order.status === "DRAFT";
  const canEdit = isDraft && !!me;

  return (
    <div className="mx-auto min-h-dvh max-w-screen-md pb-44">
      <header className="sticky top-0 z-30 border-b border-sunset-100 bg-cream/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-extrabold">
              {order.table?.name ?? "Order"} <span className="text-xs font-semibold text-ink/40">{order.code}</span>
            </h1>
            <p className="text-[11px] text-ink/50">
              {order.participants.length} peserta · {me ? `Anda: ${order.participants.find((p) => p.id === me.participantId)?.name}` : "pengamat"}
            </p>
          </div>
          <Badge status={order.status} label={isDraft ? "DRAFT BERSAMA" : order.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {order.participants.map((p) => (
            <span
              key={p.id}
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                me?.participantId === p.id ? "bg-sunset-500 text-white" : "bg-white border border-sunset-200 text-ink/60"
              }`}
            >
              {p.isHost && <Crown size={11} weight="fill" className={me?.participantId === p.id ? "text-white" : "text-gold-500"} />}
              {p.name}
            </span>
          ))}
        </div>
      </header>

      <main className="space-y-4 px-4 py-4">
        {/* Item per peserta */}
        {order.participants.map((p) => {
          const items = order.items.filter((i) => i.participantId === p.id && i.status !== "CANCELED");
          if (items.length === 0) return null;
          const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
          const mine = me?.participantId === p.id;
          return (
            <Card key={p.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-extrabold">
                  {p.name} {mine && <span className="text-[10px] font-bold text-sunset-500">(Anda)</span>}
                </p>
                <Money value={sub} className="text-sm font-bold text-ink/60" />
              </div>
              {items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 border-t border-sunset-50 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.nameSnapshot}</p>
                    <Money value={i.price * i.qty} className="text-xs text-ink/45" />
                  </div>
                  {canEdit && (mine || me!.isHost) && i.status === "DRAFT" ? (
                    <ItemControls item={i} onChanged={load} />
                  ) : (
                    <span className="text-sm font-bold">×{i.qty}</span>
                  )}
                </div>
              ))}
            </Card>
          );
        })}
        {order.items.filter((i) => i.status !== "CANCELED").length === 0 && (
          <Card className="p-6 text-center text-sm text-ink/45">
            Belum ada pesanan — tekan <b>+ Tambah Menu</b> untuk mulai memilih.
          </Card>
        )}

        {/* Ringkasan */}
        <Card className="p-4">
          <div className="flex justify-between py-0.5 text-sm"><span className="text-ink/55">Subtotal</span><Money value={bill.subtotal} /></div>
          <div className="flex justify-between py-0.5 text-sm"><span className="text-ink/55">Pajak</span><Money value={bill.tax} /></div>
          <div className="mt-1 flex justify-between border-t border-dashed border-sunset-200 pt-2 font-extrabold">
            <span>Total Sementara</span>
            <Money value={bill.total} className="text-sunset-600" />
          </div>
        </Card>

        {/* Bagikan */}
        {isDraft && order.table?.code && (
          <Button
            variant="teal"
            full
            onClick={() => {
              const url = `${window.location.origin}/t/${order.table!.code}`;
              const text = encodeURIComponent(
                `Kami lagi pesan di ${order.table!.name} ☕ Pilih menumu dari sini ya: ${url}`
              );
              window.open(`https://wa.me/?text=${text}`, "_blank");
            }}
          >
            <WhatsappLogo size={18} weight="fill" /> Bagikan Menu ke Teman
          </Button>
        )}
      </main>

      {/* Aksi bawah */}
      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sunset-100 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-screen-md gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setMenuOpen(true)}>
              <Plus size={16} weight="bold" /> Tambah Menu
            </Button>
            {me!.isHost && (
              <Button className="flex-1" disabled title="Pembayaran self-service hadir di tahap berikutnya">
                Konfirmasi & Bayar
              </Button>
            )}
          </div>
          {me!.isHost && (
            <p className="mx-auto mt-1 max-w-screen-md text-center text-[10px] text-ink/35">
              Konfirmasi & pembayaran self-service hadir di tahap 2 (sedang dikembangkan).
            </p>
          )}
        </div>
      )}

      {menuOpen && <MenuSheet orderId={id} onClose={() => setMenuOpen(false)} onAdded={load} />}
    </div>
  );
}

function ItemControls({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function setQty(qty: number) {
    setBusy(true);
    try {
      if (qty <= 0) await api(`/api/order-items/${item.id}`, { method: "DELETE" });
      else await api(`/api/order-items/${item.id}`, { method: "PATCH", body: { qty } });
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {item.qty === 1 ? (
        <Button variant="outline" disabled={busy} onClick={() => setQty(0)} className="!px-2 !py-1">
          <Trash size={13} />
        </Button>
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => setQty(item.qty - 1)} className="!px-2 !py-1">
          <Minus size={13} weight="bold" />
        </Button>
      )}
      <span className="w-5 text-center text-sm font-bold">{item.qty}</span>
      <Button disabled={busy} onClick={() => setQty(item.qty + 1)} className="!px-2 !py-1">
        <Plus size={13} weight="bold" />
      </Button>
    </div>
  );
}

function MenuSheet({ orderId, onClose, onAdded }: { orderId: string; onClose: () => void; onAdded: () => void }) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories));
  }, []);

  async function add(item: MenuItemT) {
    setBusyId(item.id);
    try {
      await api(`/api/orders/${orderId}/items`, { method: "POST", body: { items: [{ menuItemId: item.id, qty: 1 }] } });
      onAdded();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-white md:max-w-lg md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-lg font-extrabold">Pilih Menu</h2>
          <button onClick={onClose} className="text-ink/40">
            <X size={22} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-6">
          {!categories ? (
            <Spinner />
          ) : (
            categories.map((c) => (
              <div key={c.id} className="mb-4">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">{c.name}</p>
                <div className="space-y-1.5">
                  {c.items.filter((i) => i.available).map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-sunset-100 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{i.name}</p>
                        {i.description && <p className="line-clamp-1 text-xs text-ink/45">{i.description}</p>}
                        <Money value={i.price} className="text-xs font-bold text-sunset-600" />
                      </div>
                      <Button disabled={busyId === i.id} onClick={() => add(i)} className="!px-3 shrink-0">
                        <Plus size={15} weight="bold" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
