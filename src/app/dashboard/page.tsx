"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CurrencyCircleDollar, Receipt, CalendarCheck, Warning, Table as TableIcon, ForkKnife,
  SealCheck, ArrowRight, CaretDown,
} from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Card, Empty, Money, PageTitle, Spinner } from "@/components/ui";
import { formatIDR } from "@/lib/constants";
import { usePerms } from "@/lib/use-permissions";

type Report = {
  salesToday: { revenue: number; orders: number };
  salesWeek: { revenue: number; orders: number };
  openOrders: number;
  bookingsToday: { code: string; customer: string; table: string; time: string; status: string; partySize: number }[];
  topItemsWeek: { name: string; qty: number }[];
  lowStock: { name: string; stock: number; minStock: number; unit: string }[];
};
type Extra = {
  today: {
    revenue: number; orders: number; avgOrder: number; itemsSold: number;
    dineIn: { revenue: number; orders: number }; takeaway: { revenue: number; orders: number };
  };
  daily: { date: string; label: string; revenue: number; orders: number }[];
  tables: { total: number; open: number; occupied: number; booked: number };
  openOrders: { id: string; code: string; type: string; where: string; itemCount: number; createdAt: string }[];
  pendingApprovals: number | null;
};

export default function DashboardHome() {
  const { can } = usePerms();
  const [report, setReport] = useState<Report | null>(null);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [open, setOpen] = useState<string | null>("today");

  useEffect(() => {
    const load = () =>
      api<{ report: Report; extra: Extra }>("/api/reports/dashboard").then((d) => { setReport(d.report); setExtra(d.extra); });
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!report || !extra) return <Spinner />;

  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  // Definisi metrik (difilter izin). Tiap kartu bisa di-klik untuk drill-down.
  const metrics: Metric[] = [
    {
      id: "today", Icon: CurrencyCircleDollar, tone: "text-sunset-500",
      label: "Omzet Hari Ini", value: formatIDR(extra.today.revenue), sub: `${extra.today.orders} order lunas`,
    },
    {
      id: "week", Icon: CurrencyCircleDollar, tone: "text-violet-700",
      label: "Omzet 7 Hari", value: formatIDR(report.salesWeek.revenue), sub: `${report.salesWeek.orders} order`,
    },
    {
      id: "open", Icon: Receipt, tone: "text-teal-600",
      label: "Order Terbuka", value: String(report.openOrders), sub: "sedang berjalan",
    },
    {
      id: "tables", Icon: TableIcon, tone: "text-violet-600",
      label: "Meja Terisi", value: `${extra.tables.occupied}/${extra.tables.total}`, sub: `${extra.tables.open} kosong · ${extra.tables.booked} booking`,
    },
    {
      id: "booking", Icon: CalendarCheck, tone: "text-gold-600",
      label: "Booking Hari Ini", value: String(report.bookingsToday.length), sub: "aktif",
    },
    {
      id: "items", Icon: ForkKnife, tone: "text-sunset-600",
      label: "Item Terjual", value: String(extra.today.itemsSold), sub: `rata-rata ${formatIDR(extra.today.avgOrder)}/order`,
    },
  ];
  if (extra.pendingApprovals !== null)
    metrics.push({
      id: "approvals", Icon: SealCheck, tone: extra.pendingApprovals > 0 ? "text-red-500" : "text-emerald-600",
      label: "Menunggu Persetujuan", value: String(extra.pendingApprovals), sub: extra.pendingApprovals > 0 ? "perlu ditinjau" : "semua beres",
    });

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Ringkasan" subtitle="Kondisi operasional real-time — klik metrik untuk rincian" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <Stat key={m.id} m={m} active={open === m.id} onSelect={() => toggle(m.id)} />
        ))}
      </div>

      {/* Panel drill-down sesuai metrik terpilih */}
      {open && (
        <Drilldown id={open} report={report} extra={extra} can={can} />
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold">Booking Hari Ini</h2>
            {can("bookings.view") && (
              <Link href="/dashboard/bookings" className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
                Semua booking <ArrowRight size={13} />
              </Link>
            )}
          </div>
          {report.bookingsToday.length === 0 ? (
            <Empty text="Tidak ada booking aktif hari ini" />
          ) : (
            <div className="space-y-2">
              {report.bookingsToday.map((b) => (
                <div key={b.code} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
                  <div>
                    <p className="text-sm font-bold">{b.customer} · {b.table}</p>
                    <p className="text-xs text-ink/50">
                      {new Date(b.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {b.partySize} orang · {b.code}
                    </p>
                  </div>
                  <Badge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-extrabold">Terlaris Minggu Ini</h2>
              {can("history.view") && (
                <Link href="/dashboard/history" className="text-xs font-semibold text-teal-700 hover:underline">Riwayat</Link>
              )}
            </div>
            {report.topItemsWeek.length === 0 ? (
              <p className="text-sm text-ink/40">Belum ada penjualan.</p>
            ) : (
              report.topItemsWeek.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between py-1.5 text-sm">
                  <span><span className="mr-2 font-extrabold text-sunset-400">#{i + 1}</span>{t.name}</span>
                  <span className="font-bold">{t.qty}×</span>
                </div>
              ))
            )}
          </Card>
          {report.lowStock.length > 0 && (
            <Link href={can("pro.view") ? "/dashboard/pro/inventory" : "#"} className="block">
              <Card className="border-gold-200 bg-gold-50 p-4 transition-shadow hover:shadow-sm">
                <h2 className="mb-2 flex items-center gap-1.5 font-extrabold text-gold-800">
                  <Warning size={18} weight="fill" /> Stok Menipis
                </h2>
                {report.lowStock.map((s) => (
                  <p key={s.name} className="py-0.5 text-sm text-gold-900">
                    {s.name}: <b>{s.stock} {s.unit}</b> (min {s.minStock})
                  </p>
                ))}
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

type Metric = { id: string; Icon: React.ElementType; tone: string; label: string; value: string; sub: string };

function Stat({ m, active, onSelect }: { m: Metric; active: boolean; onSelect: () => void }) {
  const { Icon, tone, label, value, sub } = m;
  return (
    <button onClick={onSelect} className="text-left" aria-pressed={active}>
      <Card className={`relative p-4 transition-shadow ${active ? "shadow-md shadow-sunset-200/70" : "hover:shadow-sm"}`}>
        <div className="flex items-center gap-3">
          <Icon size={32} weight={active ? "fill" : "duotone"} className={`shrink-0 ${tone}`} />
          <div className="h-10 w-px bg-sunset-100" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs font-semibold text-ink/50">
              {label}
              <CaretDown size={11} className={`transition-transform ${active ? "rotate-180" : ""}`} />
            </p>
            <p className="truncate text-lg font-extrabold">{value}</p>
            <p className="text-[11px] text-ink/40">{sub}</p>
          </div>
        </div>
        {active && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sunset-500" />}
      </Card>
    </button>
  );
}

/** Panel rincian untuk metrik yang dipilih. */
function Drilldown({
  id, report, extra, can,
}: {
  id: string; report: Report; extra: Extra; can: (p: string) => boolean;
}) {
  return (
    <Card className="mt-3 p-4">
      {id === "today" && (
        <div>
          <DrillHead title="Rincian Omzet Hari Ini" href={can("history.view") ? "/dashboard/history" : undefined} linkLabel="Buka Riwayat" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Split label="Dine-in" rev={extra.today.dineIn.revenue} orders={extra.today.dineIn.orders} tone="text-teal-700" />
            <Split label="Takeaway" rev={extra.today.takeaway.revenue} orders={extra.today.takeaway.orders} tone="text-violet-700" />
            <div className="rounded-xl bg-cream p-3">
              <p className="text-xs text-ink/55">Rata-rata / order</p>
              <Money value={extra.today.avgOrder} className="text-lg font-extrabold" />
              <p className="text-[11px] text-ink/45">{extra.today.itemsSold} item terjual</p>
            </div>
          </div>
        </div>
      )}

      {id === "week" && (
        <div>
          <DrillHead title="Tren Omzet 7 Hari" href={can("history.view") ? "/dashboard/history" : undefined} linkLabel="Buka Riwayat" />
          <WeekChart daily={extra.daily} />
        </div>
      )}

      {id === "open" && (
        <div>
          <DrillHead title={`Order Terbuka (${extra.openOrders.length})`} href={can("pos.view") ? "/dashboard/pos" : undefined} linkLabel="Buka POS" />
          {extra.openOrders.length === 0 ? (
            <Empty text="Tidak ada order terbuka." />
          ) : (
            <div className="divide-y divide-sunset-50">
              {extra.openOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-bold">{o.code}<span className="ml-2 font-normal text-ink/50">{o.where}</span></span>
                  <span className="text-xs text-ink/45">
                    {o.type === "TAKEAWAY" ? "Takeaway" : "Dine-in"} · {o.itemCount} item · {agoLabel(o.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {id === "tables" && (
        <div>
          <DrillHead title="Status Meja" href={can("tables.view") ? "/dashboard/tables" : undefined} linkLabel="Kelola Meja" />
          <div className="grid grid-cols-3 gap-3">
            <TableStat label="Kosong" value={extra.tables.open} status="OPEN" />
            <TableStat label="Terisi" value={extra.tables.occupied} status="OCCUPIED" />
            <TableStat label="Dibooking" value={extra.tables.booked} status="BOOKED" />
          </div>
        </div>
      )}

      {id === "booking" && (
        <div>
          <DrillHead title="Booking Aktif Hari Ini" href={can("bookings.view") ? "/dashboard/bookings" : undefined} linkLabel="Kelola Booking" />
          {report.bookingsToday.length === 0 ? (
            <Empty text="Tidak ada booking aktif." />
          ) : (
            <div className="divide-y divide-sunset-50">
              {report.bookingsToday.map((b) => (
                <div key={b.code} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-bold">{b.customer}<span className="ml-2 font-normal text-ink/50">{b.table} · {b.partySize} org</span></span>
                  <span className="flex items-center gap-2 text-xs text-ink/45">
                    {new Date(b.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    <Badge status={b.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {id === "items" && (
        <div>
          <DrillHead title="Menu Terlaris (7 hari)" href={can("history.view") ? "/dashboard/history" : undefined} linkLabel="Buka Riwayat" />
          {report.topItemsWeek.length === 0 ? (
            <Empty text="Belum ada penjualan." />
          ) : (
            <div className="space-y-1.5">
              {report.topItemsWeek.map((t, i) => {
                const max = report.topItemsWeek[0].qty || 1;
                return (
                  <div key={t.name} className="flex items-center gap-2 text-sm">
                    <span className="w-32 shrink-0 truncate"><b className="mr-1 text-sunset-400">#{i + 1}</b>{t.name}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-sunset-50">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${(t.qty / max) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right font-bold">{t.qty}×</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {id === "approvals" && (
        <div>
          <DrillHead title="Permintaan Menunggu Persetujuan" href="/dashboard/approvals" linkLabel="Tinjau Sekarang" />
          <p className="text-sm text-ink/55">
            {extra.pendingApprovals && extra.pendingApprovals > 0
              ? `Ada ${extra.pendingApprovals} permintaan menunggu keputusan owner (pembatalan, penghapusan, atau perubahan menu).`
              : "Tidak ada permintaan menunggu. Semua aksi sensitif sudah ditinjau."}
          </p>
        </div>
      )}
    </Card>
  );
}

function DrillHead({ title, href, linkLabel }: { title: string; href?: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-extrabold">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100">
          {linkLabel} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

function Split({ label, rev, orders, tone }: { label: string; rev: number; orders: number; tone: string }) {
  return (
    <div className="rounded-xl bg-cream p-3">
      <p className="text-xs text-ink/55">{label}</p>
      <Money value={rev} className={`text-lg font-extrabold ${tone}`} />
      <p className="text-[11px] text-ink/45">{orders} order</p>
    </div>
  );
}

function TableStat({ label, value, status }: { label: string; value: number; status: string }) {
  return (
    <div className="rounded-xl border border-sunset-100 p-3 text-center">
      <p className="text-2xl font-extrabold">{value}</p>
      <Badge status={status} label={label} />
    </div>
  );
}

function WeekChart({ daily }: { daily: Extra["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.revenue));
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
      {daily.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-ink/45">{d.revenue > 0 ? compact(d.revenue) : ""}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-sunset-300 to-sunset-500 transition-all"
              style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
              title={`${d.label}: ${formatIDR(d.revenue)} (${d.orders} order)`}
            />
          </div>
          <span className="text-[10px] font-bold text-ink/50">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

function agoLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const h = Math.floor(mins / 60);
  return `${h}j ${mins % 60}m lalu`;
}
