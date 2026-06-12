import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ITEM_STATUS, ORDER_STATUS, TABLE_STATUS } from "@/lib/constants";
import { enterKitchen } from "@/lib/qr-flow";

type Ctx = { params: Promise<{ id: string }> };
const VALIDATOR_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

/**
 * Validasi kasir untuk order QR yang sudah lunas:
 * - approve → item dikirim ke dapur (IN_KITCHEN)
 * - void    → order dibatalkan (refund ditangani manual di luar sistem, dicatat di reason)
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...VALIDATOR_ROLES]);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status !== ORDER_STATUS.AWAITING_VALIDATION)
    return NextResponse.json({ error: `Order berstatus ${order.status}, bukan menunggu validasi` }, { status: 400 });

  if (body.action === "approve") {
    await enterKitchen(id);
    return NextResponse.json({ status: ORDER_STATUS.IN_KITCHEN });
  }
  if (body.action === "void") {
    const tx = [
      db.order.update({
        where: { id },
        data: { status: ORDER_STATUS.CANCELED, closedAt: new Date() },
      }),
      db.orderItem.updateMany({ where: { orderId: id }, data: { status: ITEM_STATUS.CANCELED } }),
    ];
    if (order.tableId)
      tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
    await db.$transaction(tx);
    return NextResponse.json({ status: ORDER_STATUS.CANCELED, note: "Refund pembayaran ditangani manual" });
  }
  return NextResponse.json({ error: 'action harus "approve" atau "void"' }, { status: 400 });
}
