import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { BOOKING_STATUS } from "@/lib/constants";
import { getGateway } from "@/lib/payments";
import { applySettlement } from "@/lib/payments/settle";
import { shortCode } from "@/lib/code";

type Ctx = { params: Promise<{ id: string }> };

/** Bayar booking fee (min payment) untuk konfirmasi booking. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;

  const booking = await db.booking.findUnique({ where: { id }, include: { customer: true } });
  if (!booking) return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  if (booking.customerId !== guard.sub && guard.role === "CUSTOMER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== BOOKING_STATUS.PENDING)
    return NextResponse.json({ error: `Booking berstatus ${booking.status}, tidak menunggu pembayaran` }, { status: 400 });
  if (booking.payDeadlineAt < new Date())
    return NextResponse.json({ error: "Batas waktu pembayaran fee sudah lewat" }, { status: 400 });

  const gateway = getGateway();
  const ref = shortCode("PAY", 8);
  const charge = await gateway.createCharge({
    ref,
    amount: booking.feeAmount,
    description: `Booking fee ${booking.code}`,
    customer: { name: booking.customer.name, email: booking.customer.email },
  });

  const payment = await db.payment.create({
    data: {
      ref,
      provider: gateway.name,
      method: "gateway",
      purpose: "BOOKING_FEE",
      status: charge.status,
      amount: booking.feeAmount,
      bookingId: booking.id,
      payerName: booking.customer.name,
      meta: JSON.stringify({ providerRef: charge.providerRef, token: charge.token }),
    },
  });

  if (charge.status === "SETTLED") await applySettlement(payment.id);

  const updated = await db.booking.findUnique({ where: { id }, include: { table: true } });
  return NextResponse.json({ payment, redirectUrl: charge.redirectUrl, booking: updated });
}
