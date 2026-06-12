import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ITEM_STATUS, ORDER_STATUS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };
const REVIEWER_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

/**
 * Tindak lanjut kasir atas draft QR yang lama idle ("Perlu Perhatian"):
 * - extend : draft masih valid (tamu memang ada) → timer TTL di-reset
 * - void   : draft iseng/tak sengaja → langsung EXPIRED
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...REVIEWER_ROLES]);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.source !== "QR" || order.status !== ORDER_STATUS.DRAFT)
    return NextResponse.json({ error: "Hanya draft QR yang bisa direview" }, { status: 400 });

  if (body.action === "extend") {
    await db.order.update({ where: { id }, data: { lastActivityAt: new Date() } });
    return NextResponse.json({ ok: true, extended: true });
  }
  if (body.action === "void") {
    await db.$transaction([
      db.order.update({ where: { id }, data: { status: ORDER_STATUS.EXPIRED, closedAt: new Date() } }),
      db.orderItem.updateMany({ where: { orderId: id }, data: { status: ITEM_STATUS.CANCELED } }),
    ]);
    return NextResponse.json({ ok: true, voided: true });
  }
  return NextResponse.json({ error: 'action harus "extend" atau "void"' }, { status: 400 });
}
