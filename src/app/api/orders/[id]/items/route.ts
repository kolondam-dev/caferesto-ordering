import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { db } from "@/lib/db";
import { ITEM_STATUS, ORDER_STATUS } from "@/lib/constants";
import { resolveOrderAccess } from "@/lib/order-access";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  items: z
    .array(z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(99), notes: z.string().optional() }))
    .min(1),
});

/**
 * Tambah item ke order. Item baru SELALU berstatus DRAFT — belum terlihat dapur.
 * Promosi DRAFT → QUEUED dilakukan lewat langkah eksplisit:
 * - Jalur QR: saat order divalidasi/masuk dapur (qr-flow enterKitchen).
 * - Jalur POS/walk-in: lewat endpoint /send-kitchen (tombol "Kirim ke Dapur").
 * Ini memberi 1 langkah validasi agar dapur hanya menerima orderan yang fix.
 */
async function handlePost(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  const access = await resolveOrderAccess(order);
  if (!access.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== ORDER_STATUS.OPEN && order.status !== ORDER_STATUS.DRAFT)
    return NextResponse.json({ error: "Order sudah dikunci/ditutup" }, { status: 400 });

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
          participantId: access.participant?.id ?? null,
          nameSnapshot: menuItem.name,
          price: menuItem.price,
          qty: it.qty,
          notes: it.notes ?? null,
          status: ITEM_STATUS.DRAFT,
        },
      })
    );
  }
  await db.order.update({ where: { id }, data: { lastActivityAt: new Date() } });
  return NextResponse.json({ items: created }, { status: 201 });
}

// Aksi tulis kritis: retry client di-dedup lewat X-Idempotency-Key
export const POST = (req: NextRequest, ctx: Ctx) => withIdempotency(req, () => handlePost(req, ctx));
