import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ITEM_STATUS, ORDER_STATUS, STAFF_ROLES } from "@/lib/constants";
import { resolveOrderAccess } from "@/lib/order-access";

type Ctx = { params: Promise<{ id: string }> };

const FLOW: Record<string, string[]> = {
  QUEUED: [ITEM_STATUS.PREPARING, ITEM_STATUS.CANCELED],
  PREPARING: [ITEM_STATUS.READY, ITEM_STATUS.CANCELED],
  READY: [ITEM_STATUS.SERVED],
};

/**
 * PATCH dua mode:
 * - { status } — kitchen/kasir memajukan alur QUEUED→PREPARING→READY→SERVED (staff only).
 * - { qty }    — edit item DRAFT di order QR (pemilik item, host, atau staff).
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: string; qty?: number };

  const item = await db.orderItem.findUnique({ where: { id }, include: { order: true } });
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

  if (body.qty !== undefined) {
    const denied = await guardDraftEdit(item);
    if (denied) return denied;
    const qty = Math.floor(Number(body.qty));
    if (!qty || qty < 1 || qty > 99)
      return NextResponse.json({ error: "Qty harus 1..99" }, { status: 400 });
    const updated = await db.orderItem.update({ where: { id }, data: { qty } });
    await db.order.update({ where: { id: item.orderId }, data: { lastActivityAt: new Date() } });
    return NextResponse.json({ item: updated });
  }

  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  if (!body.status || !(FLOW[item.status] ?? []).includes(body.status))
    return NextResponse.json({ error: `Transisi ${item.status} → ${body.status} tidak valid` }, { status: 400 });

  const updated = await db.orderItem.update({ where: { id }, data: { status: body.status } });

  // Order QR: setelah semua item tersaji, tutup order & bebaskan meja
  if (body.status === ITEM_STATUS.SERVED && item.order.source === "QR") {
    const { completeIfAllServed } = await import("@/lib/qr-flow");
    await completeIfAllServed(item.orderId);
  }
  return NextResponse.json({ item: updated });
}

/** Hapus item DRAFT dari order QR (pemilik item, host, atau staff). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = await db.orderItem.findUnique({ where: { id }, include: { order: true } });
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

  const denied = await guardDraftEdit(item);
  if (denied) return denied;

  await db.orderItem.delete({ where: { id } });
  await db.order.update({ where: { id: item.orderId }, data: { lastActivityAt: new Date() } });
  return NextResponse.json({ deleted: true });
}

async function guardDraftEdit(item: {
  status: string;
  participantId: string | null;
  order: { id: string; customerId: string | null; source: string; status: string };
}) {
  if (item.order.status !== ORDER_STATUS.DRAFT || item.status !== ITEM_STATUS.DRAFT)
    return NextResponse.json({ error: "Hanya item draft yang bisa diubah" }, { status: 400 });
  const access = await resolveOrderAccess(item.order);
  const ownsItem = access.participant && item.participantId === access.participant.id;
  if (!ownsItem && !access.isController)
    return NextResponse.json({ error: "Hanya pemilik item atau host yang bisa mengubah" }, { status: 403 });
  return null;
}
