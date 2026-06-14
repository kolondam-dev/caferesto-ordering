import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission, can } from "@/lib/permissions";
import { TABLE_STATUS } from "@/lib/constants";
import { buildReportContext } from "@/lib/ai/report-context";

/**
 * Data ringkasan diperkaya untuk dashboard: metrik + rincian drill-down.
 * Memakai buildReportContext (yang sudah menghitung penjualan hari ini,
 * rincian dine-in/takeaway, dan tren 7 hari) lalu menambah data khusus
 * dashboard: status meja, daftar order terbuka, dan jumlah persetujuan.
 */
export async function GET() {
  const guard = await requirePermission("dashboard.view");
  if (!isSession(guard)) return guard;

  const [base, tables, openOrders, pendingApprovals] = await Promise.all([
    buildReportContext(),
    db.table.findMany({ select: { status: true } }),
    db.order.findMany({
      where: { status: "OPEN" },
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
        revenue: base.salesToday.revenue,
        orders: base.salesToday.orders,
        avgOrder: base.salesTodayDetail.avgOrder,
        itemsSold: base.salesTodayDetail.itemsSold,
        dineIn: base.salesTodayDetail.dineIn,
        takeaway: base.salesTodayDetail.takeaway,
      },
      // Tren harian dari report context + label nama hari untuk chart.
      daily: base.dailyRevenue.map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString("id-ID", { weekday: "short" }),
      })),
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
