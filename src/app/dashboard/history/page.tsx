"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, Receipt as ReceiptIcon, Trash } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Money, PageTitle, Spinner } from "@/components/ui";
import { formatIDR } from "@/lib/constants";
import { usePerms } from "@/lib/use-permissions";

type Item = { id: string; nameSnapshot: string; price: number; qty: number; status: string };
type Payment = { id: string; payerName?: string | null; amount: number; provider: string; status: string; method: string };
type Bill = { subtotal: number; serviceFee: number; tax: number; total: number; settled: number; deposit: number };
type HistoryOrder = {
  id: string; code: string; type: string; status: string; source: string;
  createdAt: string; closedAt?: string | null;
  customerName?: string | null; customerPhone?: string | null; channel?: string | null;
  table?: { name: string } | null;
  items: Item[]; payments: Payment[]; bill: Bill;
};

const CHANNEL_LABEL: Record<string, string> = {
  WALKIN: "Walk-in", DINEIN: "Order tambahan, dibungkus", SHOPEEFOOD: "ShopeeFood", GOFOOD: "GoFood", WA: "WhatsApp",
};

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const { can } = usePerms();
  const [tab, setTab] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [from, setFrom] = useState(todayStr(-6));
  const [to, setTo] = useState(todayStr());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [data, setData] = useState<{ orders: HistoryOrder[]; summary: { count: number; revenue: number; paid: number } } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ type: tab, from, to, q, sort });
    api<{ orders: HistoryOrder[]; summary: { count: number; revenue: number; paid: number } }>(
      `/api/orders/history?${params}`
    ).then(setData);
  }, [tab, from, to, q, sort]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce pencarian
    return () => clearTimeout(t);
  }, [load]);

  const selected = useMemo(() => data?.orders.find((o) => o.id === selId) ?? null, [data, selId]);

  async function deleteOrder(id: string) {
    const reason = prompt("Alasan penghapusan order (opsional):") ?? "";
    const res = await api<{ pending?: boolean; deleted?: boolean; message?: string }>(
      `/api/orders/${id}?reason=${encodeURIComponent(reason)}`,
      { method: "DELETE" }
    ).catch((e) => { alert((e as Error).message); return null; });
    if (!res) return;
    if (res.pending) { alert(res.message ?? "Permintaan penghapusan menunggu persetujuan owner."); return; }
    setSelId(null);
    load();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageTitle title="Riwayat Order" subtitle="Telusuri order dine-in & takeaway" />

      {/* Tabs */}
      <div className="mb-3 flex border-b border-sunset-100">
        {([["DINE_IN", "Dine-in"], ["TAKEAWAY", "Takeaway"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setTab(v); setSelId(null); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
              tab === v ? "border-teal-600 text-teal-700" : "border-transparent text-ink/45 hover:text-ink/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-ink/60">
          Dari
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="ml-1 rounded-xl border border-sunset-200 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-ink/60">
          Sampai
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)}
            className="ml-1 rounded-xl border border-sunset-200 px-2 py-1.5 text-sm" />
        </label>
        <div className="relative min-w-[160px] flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / nama / meja…"
            className="w-full rounded-xl border border-sunset-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-400" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border border-sunset-200 px-3 py-2 text-sm">
          <option value="new">Terbaru</option>
          <option value="old">Terlama</option>
          <option value="high">Nominal tertinggi</option>
          <option value="low">Nominal terendah</option>
        </select>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span className="text-ink/55">Total order: <b className="text-ink">{data.summary.count}</b></span>
            <span className="text-ink/55">Lunas: <b className="text-ink">{data.summary.paid}</b></span>
            <span className="text-ink/55">Omzet (lunas): <b className="text-teal-700">{formatIDR(data.summary.revenue)}</b></span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Daftar */}
            <Card className="divide-y divide-sunset-50 p-0">
              {data.orders.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink/40">Tidak ada order pada rentang ini.</p>
              ) : (
                data.orders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelId(o.id)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                      selId === o.id ? "bg-teal-50" : "hover:bg-sunset-50/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {o.code}
                        <span className="ml-2 font-normal text-ink/50">
                          {o.table?.name ?? (o.channel ? CHANNEL_LABEL[o.channel] : "Takeaway")}
                          {o.customerName ? ` · ${o.customerName}` : ""}
                        </span>
                      </p>
                      <p className="text-[11px] text-ink/45">
                        {new Date(o.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{o.items.filter((i) => i.status !== "CANCELED").length} item
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Money value={o.bill.total} className="text-sm font-bold" />
                      <Badge status={o.status} />
                    </div>
                  </button>
                ))
              )}
            </Card>

            {/* Detail */}
            <Card className="h-fit p-4">
              {!selected ? (
                <p className="py-10 text-center text-sm text-ink/40">Pilih order untuk melihat detail.</p>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-extrabold">
                      {selected.code}
                      <span className="ml-2 text-xs font-semibold text-ink/40">
                        {selected.table?.name ?? (selected.channel ? CHANNEL_LABEL[selected.channel] : "Takeaway")}
                      </span>
                    </h2>
                    <Badge status={selected.status} />
                  </div>
                  <p className="text-[11px] text-ink/45">
                    {new Date(selected.createdAt).toLocaleString("id-ID")} · sumber {selected.source}
                  </p>
                  {(selected.customerName || selected.customerPhone) && (
                    <p className="mt-1 text-xs text-ink/60">
                      {selected.customerName}{selected.customerPhone ? ` · ${selected.customerPhone}` : ""}
                    </p>
                  )}

                  <div className="mt-3 max-h-64 space-y-1 overflow-y-auto border-t border-sunset-50 pt-2">
                    {selected.items.filter((i) => i.status !== "CANCELED").map((i) => (
                      <div key={i.id} className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{i.qty}× {i.nameSnapshot}</span>
                        <Money value={i.price * i.qty} className="shrink-0 font-semibold" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1 border-t border-dashed border-sunset-200 pt-2 text-sm">
                    <Row label="Subtotal" value={selected.bill.subtotal} />
                    {selected.bill.serviceFee > 0 && <Row label="Service fee" value={selected.bill.serviceFee} />}
                    <Row label="Pajak" value={selected.bill.tax} />
                    {selected.bill.deposit > 0 && <Row label="Deposit" value={-selected.bill.deposit} />}
                    <div className="flex justify-between font-extrabold">
                      <span>Total</span>
                      <Money value={selected.bill.total} className="text-sunset-600" />
                    </div>
                  </div>

                  {selected.payments.filter((p) => p.status === "SETTLED").length > 0 && (
                    <div className="mt-2 border-t border-sunset-50 pt-2 text-xs">
                      {selected.payments.filter((p) => p.status === "SETTLED").map((p) => (
                        <div key={p.id} className="flex justify-between text-ink/60">
                          <span>{p.payerName ?? p.method} ({p.provider})</span>
                          <Money value={p.amount} />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button variant="outline" full className="mt-3" onClick={() => window.open(`/receipt/${selected.id}`, "_blank")}>
                    <ReceiptIcon size={16} /> Lihat Struk
                  </Button>
                  {can("order.delete") && (
                    <Button variant="danger" full className="mt-2" onClick={() => deleteOrder(selected.id)}>
                      <Trash size={16} /> Hapus Order
                    </Button>
                  )}
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/55">{label}</span>
      <Money value={value} />
    </div>
  );
}
