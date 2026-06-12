import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ORDER_STATUS, STAFF_ROLES, TABLE_STATUS } from "@/lib/constants";
import { getOrderDue } from "@/lib/payments/settle";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { table: true, items: true, payments: true, booking: { select: { code: true, feeAmount: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (!STAFF_ROLES.includes(guard.role) && order.customerId && order.customerId !== guard.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { subtotal, tax, total, settled, deposit, due } = await getOrderDue(id);
  return NextResponse.json({ order, bill: { subtotal, tax, total, settled, deposit, due } });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.action === "cancel") {
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.status !== ORDER_STATUS.OPEN)
      return NextResponse.json({ error: "Order tidak bisa dibatalkan" }, { status: 400 });
    const tx = [
      db.order.update({ where: { id }, data: { status: ORDER_STATUS.CANCELED, closedAt: new Date() } }),
      db.orderItem.updateMany({ where: { orderId: id, status: { not: "SERVED" } }, data: { status: "CANCELED" } }),
    ];
    if (order.tableId)
      tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
    await db.$transaction(tx);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
