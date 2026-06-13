import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { db } from "@/lib/db";
import { ITEM_STATUS, ORDER_STATUS } from "@/lib/constants";
import { resolveOrderAccess } from "@/lib/order-access";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Langkah validasi POS/walk-in: promosikan item DRAFT order ini → QUEUED
 * sehingga benar-benar diterima dapur. Order tetap OPEN (pay-later).
 * Jalur QR pakai mekanisme sendiri (validasi kasir → enterKitchen).
 */
async function handlePost(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status !== ORDER_STATUS.OPEN)
    return NextResponse.json({ error: "Hanya order berjalan yang bisa dikirim ke dapur" }, { status: 400 });

  const access = await resolveOrderAccess(order);
  if (!access.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await db.orderItem.updateMany({
    where: { orderId: id, status: ITEM_STATUS.DRAFT },
    data: { status: ITEM_STATUS.QUEUED },
  });
  return NextResponse.json({ sent: res.count });
}

export const POST = (req: NextRequest, ctx: Ctx) => withIdempotency(req, () => handlePost(req, ctx));
