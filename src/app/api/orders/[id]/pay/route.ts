import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ORDER_STATUS, STAFF_ROLES } from "@/lib/constants";
import { getGateway } from "@/lib/payments";
import { applySettlement, getOrderDue } from "@/lib/payments/settle";
import { shortCode } from "@/lib/code";

type Ctx = { params: Promise<{ id: string }> };

/** Bayar sisa tagihan order. method: "gateway" (mock/midtrans) atau "cash" (kasir). */
async function handlePost(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const method = body.method === "cash" ? "cash" : "gateway";

  if (method === "cash" && !STAFF_ROLES.includes(guard.role))
    return NextResponse.json({ error: "Pembayaran cash hanya lewat kasir" }, { status: 403 });

  const { order, due } = await getOrderDue(id);
  if (order.status !== ORDER_STATUS.OPEN)
    return NextResponse.json({ error: "Order sudah ditutup" }, { status: 400 });
  if (due <= 0) return NextResponse.json({ error: "Tagihan sudah lunas" }, { status: 400 });
  if (!STAFF_ROLES.includes(guard.role) && order.customerId && order.customerId !== guard.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ref = shortCode("PAY", 8);
  let payment;
  let redirectUrl: string | null = null;

  if (method === "cash") {
    payment = await db.payment.create({
      data: { ref, provider: "cash", method: "cash", purpose: "ORDER", status: "SETTLED", settledAt: new Date(), amount: due, orderId: id, payerName: body.payerName ?? null },
    });
    await applySettlement(payment.id);
  } else {
    const gateway = getGateway();
    const charge = await gateway.createCharge({ ref, amount: due, description: `Pembayaran order ${order.code}` });
    redirectUrl = charge.redirectUrl;
    payment = await db.payment.create({
      data: {
        ref,
        provider: gateway.name,
        method: "gateway",
        purpose: "ORDER",
        status: charge.status,
        amount: due,
        orderId: id,
        payerName: body.payerName ?? guard.name,
        meta: JSON.stringify({ providerRef: charge.providerRef, token: charge.token }),
      },
    });
    if (charge.status === "SETTLED") await applySettlement(payment.id);
  }

  const result = await getOrderDue(id);
  return NextResponse.json({ payment, redirectUrl, bill: { total: result.total, due: result.due }, orderStatus: result.order.status });
}

// Aksi tulis kritis: retry client di-dedup lewat X-Idempotency-Key
export const POST = (req: NextRequest, ctx: Ctx) => withIdempotency(req, () => handlePost(req, ctx));
