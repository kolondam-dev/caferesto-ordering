"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  ArrowsSplit, CheckCircle, CookingPot, CreditCard, Crown, HourglassMedium,
  Minus, Plus, QrCode, Receipt, Trash, WhatsappLogo,
} from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Money, Spinner } from "@/components/ui";
import MenuCard from "@/components/MenuCard";
import Sheet from "@/components/Sheet";
import ConnectionBanner from "@/components/ConnectionBanner";
import { formatIDR } from "@/lib/constants";

type Participant = { id: string; name: string; isHost: boolean };
type Item = {
  id: string; menuItemId: string; nameSnapshot: string; price: number; qty: number; status: string;
  participantId: string | null;
};
type Share = { participantId: string; name: string; subtotal: number; amount: number; settled: boolean };
type OrderData = {
  order: {
    id: string; code: string; status: string; source: string; splitMode: string | null;
    table?: { name: string; code: string | null } | null;
    items: Item[];
    participants: Participant[];
  };
  bill: { subtotal: number; serviceFee: number; tax: number; total: number; settled: number; due: number };
  shares: Share[] | null;
  me: { participantId: string; isHost: boolean } | null;
};
type MenuItemT = {
  id: string; name: string; price: number; available: boolean; description?: string;
  prepMinutes?: number | null;
  photos?: { url: string; isPrimary: boolean }[];
};
type Category = { id: string; name: string; items: MenuItemT[] };

/** Halaman order kolaboratif Scan & Serve — draft bersama → bayar → validasi → dapur. */
export default function CollabOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const { order, bill, shares, me } = data;
  const isDraft = order.status === "DRAFT";
  const isPaying = order.status === "AWAITING_PAYMENT";
  const canEdit = isDraft && !!me;
  const myName = order.participants.find((p) => p.id === me?.participantId)?.name;

  async function payShare(payRemaining = false) {
    setBusy(true);
    try {
      const res = await api<{ redirectUrl: string | null }>(`/api/orders/${id}/pay-share`, {
        method: "POST",
        body: payRemaining ? { payRemaining: true } : {},
      });
      if (res.redirectUrl) window.location.href = res.redirectUrl; // Midtrans Snap
      else load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    try {
      await api(`/api/orders/${id}/finalize`, { method: "POST" });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function shareBreakdownWA() {
    if (!shares) return;
    const lines = [
      `*Rincian pesanan ${order.table?.name ?? order.code}*`,
      ...shares.map((s) => `• ${s.name}: ${formatIDR(s.amount)}`),
      `Total: ${formatIDR(bill.total)}`,
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  }

  const myShare = shares?.find((s) => s.participantId === me?.participantId);

  return (
    <div className="mx-auto min-h-dvh max-w-screen-md pb-44">
      <ConnectionBanner />
      <header className="sticky top-0 z-30 border-b border-sunset-100 bg-cream/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-extrabold">
              {order.table?.name ?? "Order"} <span className="text-xs font-semibold text-ink/40">{order.code}</span>
            </h1>
            <p className="text-[11px] text-ink/50">
              {order.participants.length} peserta · {me ? `Anda: ${myName}` : "pengamat"}
            </p>
          </div>
          <Badge status={order.status} label={isDraft ? "DRAFT BERSAMA" : undefined} />
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
        {/* Banner status */}
        {order.status === "AWAITING_VALIDATION" && (
          <Card className="flex items-center gap-3 border-teal-200 bg-teal-50 p-4">
            <HourglassMedium size={24} className="shrink-0 text-teal-600" />
            <p className="text-sm font-semibold text-teal-900">
              Pembayaran lunas ✓ — pesanan diteruskan ke kasir untuk validasi. Mohon tunggu sebentar.
            </p>
          </Card>
        )}
        {order.status === "IN_KITCHEN" && (
          <Card className="flex items-center gap-3 border-sunset-200 bg-sunset-50 p-4">
            <CookingPot size={24} className="shrink-0 text-sunset-600" />
            <p className="text-sm font-semibold text-sunset-900">
              Pesanan sedang disiapkan dapur — pantau status tiap item di bawah.
            </p>
          </Card>
        )}
        {order.status === "PAID" && (
          <Card className="border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-3 text-sm font-semibold text-emerald-900">
              <CheckCircle size={24} weight="fill" className="shrink-0 text-emerald-600" />
              Semua tersaji — terima kasih sudah mampir! 🌅
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => window.open(`/receipt/${order.id}`, "_blank")}>
                <Receipt size={16} /> Lihat / Unduh Struk
              </Button>
              {order.table?.code && (
                <Button variant="teal" className="flex-1" onClick={() => (window.location.href = `/t/${order.table!.code}`)}>
                  <Plus size={16} weight="bold" /> Ronde Baru
                </Button>
              )}
            </div>
          </Card>
        )}
        {(order.status === "CANCELED" || order.status === "EXPIRED") && (
          <Card className="border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            Order {order.status === "EXPIRED" ? "kedaluwarsa" : "dibatalkan"}. Scan QR meja untuk memulai pesanan baru.
          </Card>
        )}

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
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {!isDraft && !isPaying && <Badge status={i.status} />}×{i.qty}
                    </span>
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

        {/* Tagihan */}
        <Card className="p-4">
          <BillRow label="Subtotal" value={bill.subtotal} />
          {bill.serviceFee > 0 && <BillRow label="Service fee" value={bill.serviceFee} />}
          <BillRow label="Pajak" value={bill.tax} />
          {bill.settled > 0 && <BillRow label="Sudah dibayar" value={-bill.settled} accent />}
          <div className="mt-1 flex justify-between border-t border-dashed border-sunset-200 pt-2 font-extrabold">
            <span>{isDraft ? "Total Sementara" : bill.due > 0 ? "Sisa Tagihan" : "Total"}</span>
            <Money value={isDraft ? bill.total : bill.due > 0 ? bill.due : bill.total} className="text-sunset-600" />
          </div>
        </Card>

        {/* Fase pembayaran */}
        {isPaying && shares && (
          <Card className="p-4">
            <h2 className="mb-1 flex items-center gap-1.5 font-extrabold">
              {order.splitMode === "UPFRONT" ? <ArrowsSplit size={18} /> : <Receipt size={18} />}
              {order.splitMode === "UPFRONT" ? "Split di Muka — bayar masing-masing" : "Split Akhir — satu pembayaran"}
            </h2>
            {order.splitMode === "UPFRONT" ? (
              <>
                <div className="mt-2 space-y-1.5">
                  {shares.map((s) => (
                    <div key={s.participantId} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm">
                      <span className="font-semibold">
                        {s.name} {s.participantId === me?.participantId && <span className="text-[10px] text-sunset-500">(Anda)</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <Money value={s.amount} className="font-bold" />
                        {s.settled ? <Badge status="SETTLED" label="LUNAS" /> : <Badge status="PENDING" label="BELUM" />}
                      </span>
                    </div>
                  ))}
                </div>
                {myShare && !myShare.settled && (
                  <Button full className="mt-3" onClick={() => payShare()} disabled={busy}>
                    <QrCode size={18} /> Bayar Bagian Saya — <Money value={myShare.amount} />
                  </Button>
                )}
                {me?.isHost && bill.due <= 0 && (
                  <Button variant="teal" full className="mt-2" onClick={finalize} disabled={busy}>
                    <CheckCircle size={18} weight="fill" /> Konfirmasi Akhir & Kirim ke Kasir
                  </Button>
                )}
                {me?.isHost && bill.due > 0 && (
                  <>
                    <p className="mt-2 text-center text-[11px] text-ink/40">
                      Konfirmasi akhir terbuka setelah semua peserta lunas.
                    </p>
                    {(!myShare || myShare.settled) && (
                      <Button variant="outline" full className="mt-1" onClick={() => payShare(true)} disabled={busy}>
                        Ambil Alih & Bayar Sisa — <Money value={bill.due} />
                      </Button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mt-2 space-y-1">
                  {shares.map((s) => (
                    <div key={s.participantId} className="flex justify-between text-sm">
                      <span className="text-ink/60">{s.name}</span>
                      <Money value={s.amount} className="font-semibold" />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink/40">
                  Rincian di atas untuk membantu Anda menagih teman secara manual — pembayaran ke kasir tetap satu QR.
                </p>
                <div className="mt-3 space-y-2">
                  {me?.isHost && bill.due > 0 && (
                    <Button full onClick={() => payShare()} disabled={busy}>
                      <CreditCard size={18} /> Bayar Total — <Money value={bill.due} />
                    </Button>
                  )}
                  <Button variant="outline" full onClick={shareBreakdownWA}>
                    <WhatsappLogo size={18} weight="fill" /> Bagikan Rincian ke Teman
                  </Button>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Bagikan menu (fase draft) */}
        {isDraft && order.table?.code && (
          <Button
            variant="teal"
            full
            onClick={() => {
              const url = `${window.location.origin}/t/${order.table!.code}`;
              const text = encodeURIComponent(`Kami lagi pesan di ${order.table!.name} ☕ Pilih menumu dari sini ya: ${url}`);
              window.open(`https://wa.me/?text=${text}`, "_blank");
            }}
          >
            <WhatsappLogo size={18} weight="fill" /> Bagikan Menu ke Teman
          </Button>
        )}
      </main>

      {/* Aksi bawah (fase draft) */}
      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sunset-100 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-screen-md gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setMenuOpen(true)}>
              <Plus size={16} weight="bold" /> Tambah Menu
            </Button>
            {me!.isHost && (
              <Button
                className="flex-1"
                disabled={order.items.filter((i) => i.status === "DRAFT").length === 0}
                onClick={() => setSplitOpen(true)}
              >
                Konfirmasi & Bayar
              </Button>
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <MenuSheet
          orderId={id}
          myItems={order.items.filter((i) => i.participantId === me?.participantId && i.status === "DRAFT")}
          onClose={() => setMenuOpen(false)}
          onChanged={load}
        />
      )}
      {splitOpen && shares !== null && (
        <SplitChoiceModal
          shares={shares}
          total={bill.total}
          onClose={() => setSplitOpen(false)}
          onConfirm={async (mode) => {
            try {
              await api(`/api/orders/${id}/confirm`, { method: "POST", body: { splitMode: mode } });
              setSplitOpen(false);
              load();
            } catch (e) {
              alert((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function BillRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex justify-between py-0.5 text-sm">
      <span className="text-ink/55">{label}</span>
      <Money value={value} className={accent ? "font-semibold text-teal-600" : ""} />
    </div>
  );
}

function SplitChoiceModal({
  shares, total, onClose, onConfirm,
}: {
  shares: Share[]; total: number; onClose: () => void; onConfirm: (mode: "SINGLE" | "UPFRONT") => Promise<void>;
}) {
  const [mode, setMode] = useState<"SINGLE" | "UPFRONT">("SINGLE");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Cara Pembayaran" onClose={onClose}>
      <div>
        <p className="mb-3 text-xs text-ink/50">
          Setelah konfirmasi, pesanan terkunci (tidak bisa tambah/ubah item) dan masuk fase pembayaran.
        </p>
        <div className="space-y-2">
          <ModeOption
            active={mode === "SINGLE"}
            onClick={() => setMode("SINGLE")}
            title="Split Akhir — satu QR"
            desc="Anda membayar seluruh tagihan. Aplikasi memberi rincian per orang untuk Anda tagihkan manual ke teman."
          />
          <ModeOption
            active={mode === "UPFRONT"}
            onClick={() => setMode("UPFRONT")}
            title="Split di Muka — bayar masing-masing"
            desc="Setiap peserta mendapat QR sendiri sesuai pesanannya (plus fee & pajak proporsional)."
          />
        </div>
        <div className="mt-3 rounded-xl bg-cream p-3">
          <p className="mb-1 text-[11px] font-bold text-ink/40">PERKIRAAN RINCIAN</p>
          {shares.map((s) => (
            <div key={s.participantId} className="flex justify-between text-sm">
              <span>{s.name}</span>
              <Money value={s.amount} className="font-semibold" />
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-sunset-100 pt-1 text-sm font-extrabold">
            <span>Total</span>
            <Money value={total} />
          </div>
        </div>
        <Button
          full
          className="mt-4"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm(mode);
            setBusy(false);
          }}
        >
          {busy ? "Memproses…" : "Konfirmasi Pesanan"}
        </Button>
      </div>
    </Sheet>
  );
}

function ModeOption({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-3 text-left transition-colors ${
        active ? "border-sunset-500 bg-sunset-50" : "border-sunset-100 bg-white"
      }`}
    >
      <p className="text-sm font-extrabold">{title}</p>
      <p className="mt-0.5 text-xs text-ink/55">{desc}</p>
    </button>
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

function MenuSheet({
  orderId, myItems, onClose, onChanged,
}: {
  orderId: string; myItems: Item[]; onClose: () => void; onChanged: () => void;
}) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories));
  }, []);

  // Qty milik saya (DRAFT) per menu — untuk counter di kartu
  const qtyOf = (menuItemId: string) =>
    myItems.filter((i) => i.menuItemId === menuItemId).reduce((s, i) => s + i.qty, 0);

  async function add(menuItemId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/orders/${orderId}/items`, { method: "POST", body: { items: [{ menuItemId, qty: 1 }] } });
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(menuItemId: string) {
    if (busy) return;
    const mine = [...myItems].reverse().find((i) => i.menuItemId === menuItemId);
    if (!mine) return;
    setBusy(true);
    try {
      if (mine.qty > 1) await api(`/api/order-items/${mine.id}`, { method: "PATCH", body: { qty: mine.qty - 1 } });
      else await api(`/api/order-items/${mine.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Pilih Menu" onClose={onClose} wide>
      <div>
        {!categories ? (
          <Spinner />
        ) : (
          categories.map((c) => (
            <div key={c.id} className="mb-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">{c.name}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {c.items.map((i) => (
                  <MenuCard key={i.id} item={i} qty={qtyOf(i.id)} onAdd={() => add(i.id)} onRemove={() => remove(i.id)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
}
