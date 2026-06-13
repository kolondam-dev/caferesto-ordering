import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { db } from "@/lib/db";
import { ITEM_STATUS, ORDER_STATUS } from "@/lib/constants";
import { resolveOrderAccess } from "@/lib/order-access";
import { computeShares } from "@/lib/qr-flow";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Host mengunci draft QR dan memilih cara bayar:
 * - FULL    : 1 QR total dibayar host, tanpa rincian per member (pembayaran biasa).
 * - SINGLE  : 1 QR total dibayar host + rincian per member di struk (split akhir, K6).
 * - UPFRONT : tiap member aktif membayar QR-nya sendiri (split muka, K3).
 * Charge dibuat saat tombol bayar ditekan (endpoint pay-share).
 */
const MODES = ["FULL", "SINGLE", "UPFRONT"];
async function handlePost(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { splitMode?: string };
  const splitMode = MODES.includes(body.splitMode ?? "") ? body.splitMode! : null;
  if (!splitMode) return NextResponse.json({ error: "splitMode harus FULL, SINGLE, atau UPFRONT" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.source !== "QR" || order.status !== ORDER_STATUS.DRAFT)
    return NextResponse.json({ error: "Hanya draft QR yang bisa dikonfirmasi" }, { status: 400 });

  const access = await resolveOrderAccess(order);
  if (!access.isController)
    return NextResponse.json({ error: "Hanya host yang bisa konfirmasi pesanan" }, { status: 403 });

  const activeItems = order.items.filter((i) => i.status === ITEM_STATUS.DRAFT);
  if (activeItems.length === 0)
    return NextResponse.json({ error: "Belum ada item untuk dikonfirmasi" }, { status: 400 });

  await db.order.update({
    where: { id },
    data: { status: ORDER_STATUS.AWAITING_PAYMENT, splitMode, lastActivityAt: new Date() },
  });

  return NextResponse.json({ status: ORDER_STATUS.AWAITING_PAYMENT, splitMode, shares: await computeShares(id) });
}

// Aksi tulis kritis: retry client di-dedup lewat X-Idempotency-Key
export const POST = (req: NextRequest, ctx: Ctx) => withIdempotency(req, () => handlePost(req, ctx));
