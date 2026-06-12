import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ORDER_STATUS, STAFF_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  items: z
    .array(z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(99), notes: z.string().optional() }))
    .min(1),
});

/** Tambah item ke order — langsung masuk antrian kitchen (QUEUED). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.status !== ORDER_STATUS.OPEN)
    return NextResponse.json({ error: "Order sudah ditutup" }, { status: 400 });
  if (!STAFF_ROLES.includes(guard.role) && order.customerId && order.customerId !== guard.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Item tidak valid" }, { status: 400 });

  const created = [];
  for (const it of parsed.data.items) {
    const menuItem = await db.menuItem.findUnique({ where: { id: it.menuItemId } });
    if (!menuItem || !menuItem.available)
      return NextResponse.json({ error: `Menu tidak tersedia` }, { status: 400 });
    created.push(
      await db.orderItem.create({
        data: {
          orderId: id,
          menuItemId: menuItem.id,
          nameSnapshot: menuItem.name,
          price: menuItem.price,
          qty: it.qty,
          notes: it.notes ?? null,
        },
      })
    );
  }
  return NextResponse.json({ items: created }, { status: 201 });
}
