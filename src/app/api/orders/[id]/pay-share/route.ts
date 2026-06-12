import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { db } from "@/lib/db";
import { ORDER_STATUS } from "@/lib/constants";
import { resolveOrderAccess } from "@/lib/order-access";
import { computeShares } from "@/lib/qr-flow";
import { getGateway } from "@/lib/payments";
import { applySettlement, getOrderDue } from "@/lib/payments/settle";
import { shortCode } from "@/lib/code";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pembayaran jalur QR (status AWAITING_PAYMENT):
 * - SINGLE  : host membayar seluruh sisa tagihan (1 QR).
 * - UPFRONT : peserta membayar share-nya sendiri (item milik + fee/pajak proporsional).
 */
async function handlePost(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { payRemaining?: boolean };
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.source !== "QR" || order.status !== ORDER_STATUS.AWAITING_PAYMENT)
    return NextResponse.json({ error: "Order tidak dalam fase pembayaran" }, { status: 400 });

  const access = await resolveOrderAccess(order);
  if (!access.canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let amount: number;
  let participantId: string | null = null;
  let description: string;

  if (order.splitMode === "UPFRONT" && body.payRemaining) {
    // Host mengambil alih seluruh sisa tagihan (peserta tak kunjung bayar)
    if (!access.isController)
      return NextResponse.json({ error: "Hanya host yang bisa ambil alih sisa tagihan" }, { status: 403 });
    const { due } = await getOrderDue(id);
    if (due <= 0) return NextResponse.json({ error: "Tagihan sudah lunas" }, { status: 400 });
    amount = due;
    participantId = access.participant?.id ?? null;
    description = `Ambil alih sisa tagihan ${order.code}`;
  } else if (order.splitMode === "SINGLE") {
    if (!access.isController)
      return NextResponse.json({ error: "Split akhir: pembayaran dilakukan oleh host" }, { status: 403 });
    const { due } = await getOrderDue(id);
    if (due <= 0) return NextResponse.json({ error: "Tagihan sudah lunas" }, { status: 400 });
    amount = due;
    participantId = access.participant?.id ?? null;
    description = `Pembayaran order ${order.code}`;
  } else {
    if (!access.participant)
      return NextResponse.json({ error: "Hanya peserta yang bisa membayar share" }, { status: 403 });
    const shares = await computeShares(id);
    const mine = shares.find((s) => s.participantId === access.participant!.id);
    if (!mine || mine.amount <= 0)
      return NextResponse.json({ error: "Tidak ada tagihan untuk Anda" }, { status: 400 });
    if (mine.settled) return NextResponse.json({ error: "Share Anda sudah dibayar" }, { status: 400 });
    amount = mine.amount;
    participantId = access.participant.id;
    description = `Split bill ${order.code} — ${mine.name}`;
  }

  const gateway = getGateway();
  const ref = shortCode("PAY", 8);
  const charge = await gateway.createCharge({ ref, amount, description });

  const payment = await db.payment.create({
    data: {
      ref,
      provider: gateway.name,
      method: "gateway",
      purpose: order.splitMode === "SINGLE" ? "ORDER" : "SPLIT",
      status: charge.status,
      amount,
      orderId: id,
      participantId,
      payerName: access.participant?.name ?? access.session?.name ?? null,
      meta: JSON.stringify({ providerRef: charge.providerRef, token: charge.token }),
    },
  });
  if (charge.status === "SETTLED") await applySettlement(payment.id);

  const after = await db.order.findUniqueOrThrow({ where: { id } });
  const { due } = await getOrderDue(id);
  return NextResponse.json({
    payment: { id: payment.id, ref, amount, status: charge.status },
    redirectUrl: charge.redirectUrl,
    orderStatus: after.status,
    due,
  });
}

// Aksi tulis kritis: retry client di-dedup lewat X-Idempotency-Key
export const POST = (req: NextRequest, ctx: Ctx) => withIdempotency(req, () => handlePost(req, ctx));
