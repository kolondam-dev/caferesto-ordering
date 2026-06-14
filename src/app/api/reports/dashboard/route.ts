import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission, can } from "@/lib/permissions";
import { ORDER_STATUS, TABLE_STATUS } from "@/lib/constants";
import { buildReportContext } from "@/lib/ai/report-context";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Data ringkasan diperkaya untuk dashboard: metrik + rincian drill-down.
 * Terpisah dari buildReportContext (yang dipakai AI) agar bisa disesuaikan,
 * namun memakainya sebagai basis untuk booking/terlaris/stok.
 */
export async function GET() {
  const guard = await requirePermission("dashboard.view");
  if (!isSession(guard)) return guard;

  const today = startOfDay();
  const weekAgo = new Date(today.getTime() - 6 * 86400_000);

  const [base, paidWeek, tables, openOrders, pendingApprovals] = await Promise.all([
    buildReportContext(),
    db.order.findMany({
      where: { status: ORDER_STATUS.PAID, closedAt: { gte: weekAgo } },
      select: { id: true, type: true, closedAt: true, items: { select: { price: true, qty: true, status: true } } },
    }),
    db.table.findMany({ select: { status: true } }),
    db.order.findMany({
      where: { status: ORDER_STATUS.OPEN },
      select: {
        id: true, code: true, type: true, createdAt: true,
        table: { select: { name: true } },
        customerName: true, channel: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
    (await can(guard.role, "approvals.review"))
      ? db.approvalRequest.count({ where: { status: "PENDING" } })
      : Promise.resolve(null),
  ]);

  const orderRevenue = (o: { items: { price: number; qty: number; status: string }[] }) =>
    o.items.filter((i) => i.status !== "CANCELED").reduce((s, i) => s + i.price * i.qty, 0);
  const orderItemsCount = (o: { items: { qty: number; status: string }[] }) =>
    o.items.filter((i) => i.status !== "CANCELED").reduce((s, i) => s + i.qty, 0);

  const paidToday = paidWeek.filter((o) => o.closedAt && o.closedAt >= today);
  const dineInToday = paidToday.filter((o) => o.type === "DINE_IN");
  const takeawayToday = paidToday.filter((o) => o.type === "TAKEAWAY");
  const revToday = paidToday.reduce((s, o) => s + orderRevenue(o), 0);
  const itemsSoldToday = paidToday.reduce((s, o) => s + orderItemsCount(o), 0);

  // Tren 7 hari (untuk mini bar chart)
  const daily: { date: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400_000);
    daily.push({
      date: dayKey(d),
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      revenue: 0,
      orders: 0,
    });
  }
  const byDay = new Map(daily.map((d) => [d.date, d]));
  for (const o of paidWeek) {
    if (!o.closedAt) continue;
    const bucket = byDay.get(dayKey(o.closedAt));
    if (bucket) {
      bucket.revenue += orderRevenue(o);
      bucket.orders += 1;
    }
  }

  const tableSummary = {
    total: tables.length,
    open: tables.filter((t) => t.status === TABLE_STATUS.OPEN).length,
    occupied: tables.filter((t) => t.status === TABLE_STATUS.OCCUPIED).length,
    booked: tables.filter((t) => t.status === TABLE_STATUS.BOOKED).length,
  };

  return NextResponse.json({
    report: base,
    extra: {
      today: {
        revenue: revToday,
        orders: paidToday.length,
        avgOrder: paidToday.length ? Math.round(revToday / paidToday.length) : 0,
        itemsSold: itemsSoldToday,
        dineIn: { revenue: dineInToday.reduce((s, o) => s + orderRevenue(o), 0), orders: dineInToday.length },
        takeaway: { revenue: takeawayToday.reduce((s, o) => s + orderRevenue(o), 0), orders: takeawayToday.length },
      },
      daily,
      tables: tableSummary,
      openOrders: openOrders.map((o) => ({
        id: o.id,
        code: o.code,
        type: o.type,
        where: o.table?.name ?? o.customerName ?? o.channel ?? "Takeaway",
        itemCount: o._count.items,
        createdAt: o.createdAt,
      })),
      pendingApprovals,
    },
  });
}
