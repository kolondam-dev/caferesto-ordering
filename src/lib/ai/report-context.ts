import { db } from "../db";
import { ORDER_STATUS, BOOKING_STATUS, formatIDR } from "../constants";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Kumpulkan snapshot data operasional sebagai konteks untuk AI agent.
 * Dipakai baik untuk prompt Gemini maupun jawaban mode mock.
 */
export async function buildReportContext() {
  const today = startOfDay();
  const weekAgo = new Date(today.getTime() - 6 * 86400_000);

  const [paidToday, paidWeek, openOrders, bookingsToday, lowStock, payablesDue, topRows] =
    await Promise.all([
      db.order.findMany({
        where: { status: ORDER_STATUS.PAID, closedAt: { gte: today } },
        include: { items: true },
      }),
      db.order.findMany({
        where: { status: ORDER_STATUS.PAID, closedAt: { gte: weekAgo } },
        include: { items: true },
      }),
      db.order.count({ where: { status: ORDER_STATUS.OPEN } }),
      db.booking.findMany({
        where: {
          scheduledAt: { gte: today, lt: new Date(today.getTime() + 86400_000) },
          status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.SEATED] },
        },
        include: { table: true, customer: true },
      }),
      db.inventoryItem.findMany({ where: {} }).then((items) => items.filter((i) => i.stock <= i.minStock)),
      db.payable.findMany({ where: { status: { not: "PAID" } }, include: { supplier: true } }),
      db.orderItem.groupBy({
        by: ["nameSnapshot"],
        where: { order: { status: ORDER_STATUS.PAID, closedAt: { gte: weekAgo } }, status: { not: "CANCELED" } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 5,
      }),
    ]);

  const sum = (orders: { items: { price: number; qty: number; status: string }[] }[]) =>
    orders.reduce(
      (s, o) => s + o.items.filter((i) => i.status !== "CANCELED").reduce((t, i) => t + i.price * i.qty, 0),
      0
    );

  return {
    generatedAt: new Date().toISOString(),
    salesToday: { revenue: sum(paidToday), orders: paidToday.length },
    salesWeek: { revenue: sum(paidWeek), orders: paidWeek.length },
    openOrders,
    bookingsToday: bookingsToday.map((b) => ({
      code: b.code,
      customer: b.customer.name,
      table: b.table.name,
      time: b.scheduledAt.toISOString(),
      status: b.status,
      partySize: b.partySize,
    })),
    topItemsWeek: topRows.map((r) => ({ name: r.nameSnapshot, qty: r._sum.qty ?? 0 })),
    lowStock: lowStock.map((i) => ({ name: i.name, stock: i.stock, minStock: i.minStock, unit: i.unit })),
    payablesOutstanding: payablesDue.map((p) => ({
      supplier: p.supplier.name,
      invoice: p.invoiceNo,
      remaining: p.amount - p.paidAmount,
      dueDate: p.dueDate.toISOString().slice(0, 10),
    })),
  };
}

export type ReportContext = Awaited<ReturnType<typeof buildReportContext>>;

/** Jawaban deterministik ketika GEMINI_API_KEY kosong — tetap berbasis data asli. */
export function mockAnswer(question: string, ctx: ReportContext): string {
  const q = question.toLowerCase();
  const lines: string[] = [];

  if (q.includes("stok") || q.includes("stock") || q.includes("inventory")) {
    lines.push("*Laporan Stok Menipis*", "");
    if (ctx.lowStock.length === 0) lines.push("Semua stok di atas batas minimum. ✅");
    else {
      lines.push("| Bahan | Stok | Min |", "|---|---|---|");
      for (const i of ctx.lowStock) lines.push(`| ${i.name} | ${i.stock} ${i.unit} | ${i.minStock} ${i.unit} |`);
    }
  } else if (q.includes("booking") || q.includes("reservasi")) {
    lines.push("*Booking Hari Ini*", "");
    if (ctx.bookingsToday.length === 0) lines.push("Belum ada booking aktif hari ini.");
    else {
      lines.push("| Kode | Pelanggan | Meja | Jam | Status |", "|---|---|---|---|---|");
      for (const b of ctx.bookingsToday)
        lines.push(
          `| ${b.code} | ${b.customer} | ${b.table} | ${new Date(b.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} | ${b.status} |`
        );
    }
  } else if (q.includes("utang") || q.includes("payable") || q.includes("supplier")) {
    lines.push("*Utang Supplier Outstanding*", "");
    if (ctx.payablesOutstanding.length === 0) lines.push("Tidak ada utang supplier yang belum lunas. ✅");
    else {
      lines.push("| Supplier | Invoice | Sisa | Jatuh Tempo |", "|---|---|---|---|");
      for (const p of ctx.payablesOutstanding)
        lines.push(`| ${p.supplier} | ${p.invoice} | ${formatIDR(p.remaining)} | ${p.dueDate} |`);
    }
  } else {
    lines.push("*Ringkasan Penjualan*", "");
    lines.push(`📊 Hari ini: *${formatIDR(ctx.salesToday.revenue)}* dari ${ctx.salesToday.orders} order lunas.`);
    lines.push(`📈 7 hari terakhir: *${formatIDR(ctx.salesWeek.revenue)}* dari ${ctx.salesWeek.orders} order.`);
    lines.push(`🧾 Order masih terbuka: ${ctx.openOrders}.`, "");
    if (ctx.topItemsWeek.length > 0) {
      lines.push("*Menu terlaris minggu ini:*", "", "| Menu | Terjual |", "|---|---|");
      for (const t of ctx.topItemsWeek) lines.push(`| ${t.name} | ${t.qty} |`);
    }
  }
  lines.push("", "_Mode mock aktif — isi GEMINI_API_KEY untuk jawaban AI penuh._");
  return lines.join("\n");
}
