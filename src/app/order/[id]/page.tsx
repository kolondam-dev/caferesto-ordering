"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowsSplit, CreditCard, Plus, X } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Input, Money, Spinner } from "@/components/ui";
import Sheet from "@/components/Sheet";
import CustomerShell from "@/components/CustomerShell";

type Item = { id: string; nameSnapshot: string; price: number; qty: number; status: string; notes?: string };
type Payment = { id: string; payerName?: string; amount: number; status: string; purpose: string; provider: string };
type OrderData = {
  order: {
    id: string; code: string; status: string; type: string;
    table?: { name: string } | null; booking?: { code: string } | null;
    items: Item[]; payments: Payment[];
  };
  bill: { subtotal: number; serviceFee: number; tax: number; total: number; settled: number; deposit: number; due: number };
};

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<OrderData | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<OrderData>(`/api/orders/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // live status dapur
    return () => clearInterval(t);
  }, [load]);

  async function payFull() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ redirectUrl: string | null }>(`/api/orders/${id}/pay`, { method: "POST", body: { method: "gateway" } });
      if (res.redirectUrl) window.location.href = res.redirectUrl;
      else load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data)
    return (
      <CustomerShell>
        <p className="text-red-600">{error}</p>
      </CustomerShell>
    );
  if (!data)
    return (
      <CustomerShell>
        <Spinner />
      </CustomerShell>
    );

  const { order, bill } = data;
  const activeItems = order.items.filter((i) => i.status !== "CANCELED");

  return (
    <CustomerShell>
      <div className="mx-auto grid max-w-3xl gap-4 lg:max-w-5xl lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold">
                {order.code} {order.table ? `· ${order.table.name}` : "· Takeaway"}
              </h1>
              {order.booking && <p className="text-xs text-ink/50">Dari booking {order.booking.code}</p>}
            </div>
            <Badge status={order.status} />
          </div>

          <Card className="divide-y divide-sunset-50 p-1">
            {activeItems.length === 0 && <p className="p-4 text-sm text-ink/40">Belum ada item.</p>}
            {activeItems.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {i.qty}× {i.nameSnapshot}
                  </p>
                  {i.notes && <p className="text-xs text-ink/40">{i.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge status={i.status} />
                  <Money value={i.price * i.qty} className="text-sm font-bold" />
                </div>
              </div>
            ))}
          </Card>

          {order.status === "OPEN" && (
            <Link href="/">
              <Button variant="outline" className="mt-3">
                <Plus size={16} /> Tambah Menu
              </Button>
            </Link>
          )}
        </div>

        {/* Tagihan */}
        <div>
          <Card className="p-4">
            <h2 className="mb-3 font-extrabold">Tagihan</h2>
            <Row label="Subtotal" value={bill.subtotal} />
            {bill.serviceFee > 0 && <Row label="Service fee" value={bill.serviceFee} />}
            <Row label="Pajak" value={bill.tax} />
            {bill.deposit > 0 && <Row label="Deposit booking fee" value={-bill.deposit} accent />}
            {bill.settled > 0 && <Row label="Sudah dibayar" value={-bill.settled} accent />}
            <div className="my-2 border-t border-dashed border-sunset-200" />
            <div className="flex items-center justify-between">
              <span className="font-bold">Sisa Tagihan</span>
              <Money value={bill.due} className="text-lg font-extrabold text-sunset-600" />
            </div>

            {order.status === "OPEN" && bill.due > 0 && (
              <div className="mt-4 space-y-2">
                <Button full onClick={payFull} disabled={busy}>
                  <CreditCard size={18} /> Bayar Semua
                </Button>
                <Button variant="secondary" full onClick={() => setSplitOpen(true)} disabled={busy}>
                  <ArrowsSplit size={18} /> Split Bill
                </Button>
              </div>
            )}
            {order.status === "PAID" && (
              <>
                <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">
                  Lunas — terima kasih! 🌅
                </p>
                <Button variant="teal" full className="mt-2" onClick={() => window.open(`/receipt/${order.id}`, "_blank")}>
                  Lihat / Unduh Struk
                </Button>
              </>
            )}
            {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
          </Card>

          {order.payments.length > 0 && (
            <Card className="mt-3 p-4">
              <h3 className="mb-2 text-sm font-extrabold">Riwayat Pembayaran</h3>
              {order.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-ink/60">
                    {p.payerName ?? p.purpose} <span className="text-[10px] text-ink/30">({p.provider})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Money value={p.amount} className="font-semibold" />
                    <Badge status={p.status} />
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {splitOpen && (
        <SplitModal
          orderId={id}
          items={activeItems}
          due={bill.due}
          onClose={() => setSplitOpen(false)}
          onDone={() => {
            setSplitOpen(false);
            load();
          }}
        />
      )}
    </CustomerShell>
  );
}

function Row({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink/60">{label}</span>
      <Money value={value} className={accent ? "font-semibold text-teal-600" : "font-semibold"} />
    </div>
  );
}

function SplitModal({
  orderId, items, due, onClose, onDone,
}: {
  orderId: string; items: Item[]; due: number; onClose: () => void; onDone: () => void;
}) {
  const [mode, setMode] = useState<"even" | "items">("even");
  const [names, setNames] = useState<string[]>(["", ""]);
  // mode items: itemId -> index peserta
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const body =
        mode === "even"
          ? { mode, names: names.map((n) => n.trim()).filter(Boolean) }
          : {
              mode,
              shares: names
                .map((name, idx) => ({
                  name: name.trim() || `Peserta ${idx + 1}`,
                  itemIds: items.filter((i) => assign[i.id] === idx).map((i) => i.id),
                }))
                .filter((s) => s.itemIds.length > 0),
            };
      await api(`/api/orders/${orderId}/split`, { method: "POST", body });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const perPerson = Math.ceil(due / Math.max(1, names.filter((n) => n.trim()).length));

  return (
    <Sheet title="Split Bill" onClose={onClose} wide>
      <div>

        <div className="mb-4 flex gap-2">
          <Button variant={mode === "even" ? "primary" : "outline"} onClick={() => setMode("even")} className="flex-1">
            Bagi Rata
          </Button>
          <Button variant={mode === "items" ? "primary" : "outline"} onClick={() => setMode("items")} className="flex-1">
            Per Item
          </Button>
        </div>

        <div className="space-y-2">
          {names.map((n, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder={`Nama peserta ${i + 1}`} value={n} onChange={(e) => setNames((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} />
              {names.length > 2 && (
                <Button variant="outline" onClick={() => setNames((arr) => arr.filter((_, j) => j !== i))}>
                  <X size={14} />
                </Button>
              )}
            </div>
          ))}
          <Button variant="ghost" onClick={() => setNames((arr) => [...arr, ""])}>
            <Plus size={14} /> Tambah peserta
          </Button>
        </div>

        {mode === "even" ? (
          <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-900">
            Sisa tagihan <b><Money value={due} /></b> dibagi rata — sekitar <b><Money value={perPerson} /></b> per orang.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-ink/50">Tap nomor peserta untuk setiap item:</p>
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-sunset-100 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.qty}× {item.nameSnapshot}
                  </p>
                  <Money value={item.price * item.qty} className="text-xs text-ink/50" />
                </div>
                <div className="flex shrink-0 gap-1">
                  {names.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAssign((a) => ({ ...a, [item.id]: idx }))}
                      className={`h-8 w-8 rounded-lg text-xs font-bold ${
                        assign[item.id] === idx ? "bg-violet-700 text-white" : "bg-violet-50 text-violet-700"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-ink/40">Pajak & deposit dibagi proporsional sesuai nilai item tiap peserta.</p>
          </div>
        )}

        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <Button full className="mt-4" onClick={submit} disabled={busy || names.filter((n) => n.trim()).length < (mode === "even" ? 2 : 1)}>
          {busy ? "Memproses…" : "Proses Pembayaran Split"}
        </Button>
      </div>
    </Sheet>
  );
}
