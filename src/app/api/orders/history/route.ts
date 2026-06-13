import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { orderTotal } from "@/lib/constants";

const VIEW_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

/**
 * Riwayat order untuk backoffice. Filter: type (DINE_IN|TAKEAWAY), rentang
 * tanggal (from/to, inklusif), pencarian (kode/nama/meja), sort.
 * Mengembalikan order + total terhitung untuk daftar & detail.
 *
 * Catatan RBAC/shift: parameter `cashierId` & rentang waktu sudah disiapkan
 * agar nanti bisa di-drill-down per sesi/shift saat RBAC diterapkan.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole([...VIEW_ROLES]);
  if (!isSession(guard)) return guard;

  const sp = req.nextUrl.searchParams;
  const typeParam = sp.get("type");
  const type = typeParam === "TAKEAWAY" ? "TAKEAWAY" : typeParam === "ALL" ? null : "DINE_IN";
  const q = (sp.get("q") ?? "").trim();
  const sort = sp.get("sort") ?? "new";
  const cashierId = sp.get("cashierId") ?? undefined; // disiapkan untuk shift/RBAC

  const now = new Date();
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = sp.get("to") ? new Date(sp.get("to")!) : now;
  // inklusif sampai akhir hari "to"
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const orderBy =
    sort === "old" ? { createdAt: "asc" as const } : { createdAt: "desc" as const };

  const orders = await db.order.findMany({
    where: {
      ...(type ? { type } : {}),
      createdAt: { gte: from, lte: toEnd },
      ...(cashierId ? { customerId: cashierId } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" as const } },
              { customerName: { contains: q, mode: "insensitive" as const } },
              { table: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy,
    include: {
      table: { select: { name: true } },
      items: true,
      payments: true,
    },
    take: 200,
  });

  const mapped = orders.map((o) => {
    const { subtotal, serviceFee, tax, total } = orderTotal(o.items, o.taxPercent, {
      type: o.serviceFeeType,
      value: o.serviceFeeValue,
    });
    const settled = o.payments.filter((p) => p.status === "SETTLED").reduce((s, p) => s + p.amount, 0);
    return {
      ...o,
      bill: { subtotal, serviceFee, tax, total: total - o.depositApplied, settled, deposit: o.depositApplied },
    };
  });

  // Sort total bila diminta (di memori, karena total terhitung)
  if (sort === "high") mapped.sort((a, b) => b.bill.total - a.bill.total);
  if (sort === "low") mapped.sort((a, b) => a.bill.total - b.bill.total);

  const summary = {
    count: mapped.length,
    revenue: mapped.filter((o) => o.status === "PAID").reduce((s, o) => s + o.bill.total, 0),
    paid: mapped.filter((o) => o.status === "PAID").length,
  };

  return NextResponse.json({ orders: mapped, summary });
}
