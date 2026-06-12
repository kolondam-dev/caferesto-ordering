import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ITEM_STATUS, STAFF_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const FLOW: Record<string, string[]> = {
  QUEUED: [ITEM_STATUS.PREPARING, ITEM_STATUS.CANCELED],
  PREPARING: [ITEM_STATUS.READY, ITEM_STATUS.CANCELED],
  READY: [ITEM_STATUS.SERVED],
};

/** Update status item oleh kitchen/kasir mengikuti alur QUEUED→PREPARING→READY→SERVED. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const { status } = (await req.json()) as { status?: string };

  const item = await db.orderItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
  if (!status || !(FLOW[item.status] ?? []).includes(status))
    return NextResponse.json({ error: `Transisi ${item.status} → ${status} tidak valid` }, { status: 400 });

  const updated = await db.orderItem.update({ where: { id }, data: { status } });
  return NextResponse.json({ item: updated });
}
