import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ORDER_STATUS } from "@/lib/constants";
import { resolveOrderAccess } from "@/lib/order-access";
import { getOrderDue } from "@/lib/payments/settle";
import { moveToValidationOrKitchen } from "@/lib/qr-flow";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Konfirmasi akhir host (mode UPFRONT): setelah semua peserta lunas,
 * order diteruskan ke antrian validasi kasir (atau langsung dapur).
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.source !== "QR" || order.status !== ORDER_STATUS.AWAITING_PAYMENT)
    return NextResponse.json({ error: "Order tidak dalam fase pembayaran" }, { status: 400 });

  const access = await resolveOrderAccess(order);
  if (!access.isController)
    return NextResponse.json({ error: "Hanya host yang bisa konfirmasi akhir" }, { status: 403 });

  const { due } = await getOrderDue(id);
  if (due > 0)
    return NextResponse.json({ error: "Masih ada peserta yang belum membayar" }, { status: 400 });

  const status = await moveToValidationOrKitchen(id);
  return NextResponse.json({ status });
}
