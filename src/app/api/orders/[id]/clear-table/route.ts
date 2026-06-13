import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { BOOKING_STATUS, ITEM_STATUS, ORDER_STATUS, TABLE_STATUS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };
const VALIDATOR_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

/**
 * Kasir membebaskan meja setelah memverifikasi semua pesanan tersaji.
 * Tidak otomatis — payment hanya menutup tagihan; pembebasan meja butuh
 * konfirmasi manual ini. Item QUEUED/PREPARING/READY yang tersisa otomatis
 * ditandai SERVED (dianggap selesai diantar saat kasir membersihkan meja).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...VALIDATOR_ROLES]);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (!order.tableId) return NextResponse.json({ error: "Order tanpa meja" }, { status: 400 });
  // Hanya order yang sudah lunas/ditutup yang bisa dibersihkan; order OPEN harus dibayar dulu.
  if (order.status !== ORDER_STATUS.PAID)
    return NextResponse.json({ error: "Order belum lunas — selesaikan pembayaran dulu" }, { status: 400 });

  await db.$transaction([
    db.orderItem.updateMany({
      where: { orderId: id, status: { in: [ITEM_STATUS.QUEUED, ITEM_STATUS.PREPARING, ITEM_STATUS.READY] } },
      data: { status: ITEM_STATUS.SERVED },
    }),
    db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }),
    ...(order.bookingId
      ? [db.booking.update({ where: { id: order.bookingId }, data: { status: BOOKING_STATUS.COMPLETED } })]
      : []),
  ]);
  return NextResponse.json({ cleared: true });
}
