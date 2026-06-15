import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ORDER_STATUS, STAFF_ROLES, TABLE_STATUS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Kasir mengambil order mandiri pelanggan (handoff): tetapkan meja (dine-in)
 * atau biarkan takeaway, lalu jadikan order POS aktif (OPEN) untuk diproses
 * (kirim ke dapur & bayar) lewat alur POS biasa.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { tableId?: string };

  const order = await db.order.findUnique({ where: { id } });
  if (!order || order.handoff !== "CASHIER" || order.status !== ORDER_STATUS.DRAFT)
    return NextResponse.json({ error: "Order tidak tersedia untuk diproses" }, { status: 400 });

  let tableId: string | null = null;
  if (order.type === "DINE_IN") {
    const table = body.tableId ? await db.table.findUnique({ where: { id: body.tableId } }) : null;
    if (!table) return NextResponse.json({ error: "Pilih meja untuk dine-in" }, { status: 400 });
    if (table.status === TABLE_STATUS.OCCUPIED)
      return NextResponse.json({ error: "Meja sedang terisi" }, { status: 409 });
    tableId = table.id;
  }

  await db.$transaction([
    db.order.update({
      where: { id },
      data: { handoff: null, source: "POS", status: ORDER_STATUS.OPEN, tableId, lastActivityAt: new Date() },
    }),
    ...(tableId ? [db.table.update({ where: { id: tableId }, data: { status: TABLE_STATUS.OCCUPIED } })] : []),
  ]);

  return NextResponse.json({ ok: true, orderId: id });
}
