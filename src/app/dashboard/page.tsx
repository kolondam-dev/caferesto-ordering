"use client";

import { useEffect, useState } from "react";
import { CurrencyCircleDollar, Receipt, CalendarCheck, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { formatIDR } from "@/lib/constants";

type Report = {
  salesToday: { revenue: number; orders: number };
  salesWeek: { revenue: number; orders: number };
  openOrders: number;
  bookingsToday: { code: string; customer: string; table: string; time: string; status: string; partySize: number }[];
  topItemsWeek: { name: string; qty: number }[];
  lowStock: { name: string; stock: number; minStock: number; unit: string }[];
};

export default function DashboardHome() {
  const [report, setReport] = useState<Report | null>(null);
  const [selected, setSelected] = useState("today");

  useEffect(() => {
    const load = () => api<{ report: Report }>("/api/reports/summary").then((d) => setReport(d.report));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!report) return <Spinner />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Ringkasan" subtitle="Kondisi operasional real-time" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat id="today" selected={selected} onSelect={setSelected} Icon={CurrencyCircleDollar} tone="text-sunset-500" label="Omzet Hari Ini" value={formatIDR(report.salesToday.revenue)} sub={`${report.salesToday.orders} order lunas`} />
        <Stat id="week" selected={selected} onSelect={setSelected} Icon={CurrencyCircleDollar} tone="text-violet-700" label="Omzet 7 Hari" value={formatIDR(report.salesWeek.revenue)} sub={`${report.salesWeek.orders} order`} />
        <Stat id="open" selected={selected} onSelect={setSelected} Icon={Receipt} tone="text-teal-600" label="Order Terbuka" value={String(report.openOrders)} sub="sedang berjalan" />
        <Stat id="booking" selected={selected} onSelect={setSelected} Icon={CalendarCheck} tone="text-gold-600" label="Booking Hari Ini" value={String(report.bookingsToday.length)} sub="aktif" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 font-extrabold">Booking Hari Ini</h2>
          {report.bookingsToday.length === 0 ? (
            <Empty text="Tidak ada booking aktif hari ini" />
          ) : (
            <div className="space-y-2">
              {report.bookingsToday.map((b) => (
                <div key={b.code} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
                  <div>
                    <p className="text-sm font-bold">
                      {b.customer} · {b.table}
                    </p>
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
            <h2 className="mb-3 font-extrabold">Terlaris Minggu Ini</h2>
            {report.topItemsWeek.length === 0 ? (
              <p className="text-sm text-ink/40">Belum ada penjualan.</p>
            ) : (
              report.topItemsWeek.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between py-1.5 text-sm">
                  <span>
                    <span className="mr-2 font-extrabold text-sunset-400">#{i + 1}</span>
                    {t.name}
                  </span>
                  <span className="font-bold">{t.qty}×</span>
                </div>
              ))
            )}
          </Card>
          {report.lowStock.length > 0 && (
            <Card className="border-gold-200 bg-gold-50 p-4">
              <h2 className="mb-2 flex items-center gap-1.5 font-extrabold text-gold-800">
                <Warning size={18} weight="fill" /> Stok Menipis
              </h2>
              {report.lowStock.map((s) => (
                <p key={s.name} className="py-0.5 text-sm text-gold-900">
                  {s.name}: <b>{s.stock} {s.unit}</b> (min {s.minStock})
                </p>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Metric card: ikon tanpa background (size 32), divider memisahkan ikon dan teks.
 * State selected ditandai ring aksen + indikator garis bawah — tanpa mengubah
 * background maupun ukuran kartu.
 */
function Stat({
  id, selected, onSelect, Icon, tone, label, value, sub,
}: {
  id: string; selected: string; onSelect: (id: string) => void;
  Icon: React.ElementType; tone: string; label: string; value: string; sub: string;
}) {
  const active = selected === id;
  return (
    <button onClick={() => onSelect(id)} className="text-left" aria-pressed={active}>
      <Card
        className={`relative p-4 transition-shadow ${
          active ? "ring-2 ring-sunset-400 ring-offset-2 ring-offset-cream" : "hover:ring-1 hover:ring-sunset-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={32} weight={active ? "fill" : "duotone"} className={`shrink-0 ${tone}`} />
          <div className="h-10 w-px bg-sunset-100" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink/50">{label}</p>
            <p className="truncate text-lg font-extrabold">{value}</p>
            <p className="text-[11px] text-ink/40">{sub}</p>
          </div>
        </div>
        {active && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sunset-500" />}
      </Card>
    </button>
  );
}
