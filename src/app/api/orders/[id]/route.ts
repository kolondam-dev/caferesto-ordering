import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { ORDER_STATUS, STAFF_ROLES, TABLE_STATUS } from "@/lib/constants";
import { getOrderDue } from "@/lib/payments/settle";
import { resolveOrderAccess } from "@/lib/order-access";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      table: { select: { name: true, code: true } },
      items: true,
      payments: true,
      booking: { select: { code: true, feeAmount: true } },
      participants: { orderBy: { joinedAt: "asc" } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const access = await resolveOrderAccess(order);
  if (!access.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { subtotal, serviceFee, tax, total, settled, deposit, due } = await getOrderDue(id);

  // Rincian per member (jalur QR) — dipakai untuk QR bayar UPFRONT & rincian split akhir
  let shares = null;
  if (order.source === "QR" && order.items.length > 0) {
    const { computeShares } = await import("@/lib/qr-flow");
    shares = await computeShares(id);
  }

  return NextResponse.json({
    order: {
      ...order,
      participants: order.participants.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost })),
    },
    bill: { subtotal, serviceFee, tax, total, settled, deposit, due },
    shares,
    me: access.participant ? { participantId: access.participant.id, isHost: access.participant.isHost } : null,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.action === "cancel") {
    // Aturan peran: hanya yang punya izin pos.cancel_order (kasir tidak).
    const permGuard = await requirePermission("pos.cancel_order");
    if (!isSession(permGuard)) return permGuard;
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
