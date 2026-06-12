import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGateway } from "@/lib/payments";
import { applySettlement } from "@/lib/payments/settle";

/**
 * Webhook notifikasi pembayaran (Midtrans-ready).
 * Midtrans: set Notification URL ke {BASE_URL}/api/payments/webhook
 */
export async function POST(req: NextRequest) {
  const gateway = getGateway();
  let event;
  try {
    event = await gateway.parseWebhook(await req.json(), req.headers);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const payment = await db.payment.findUnique({ where: { ref: event.ref } });
  if (!payment) return NextResponse.json({ error: "Payment tidak ditemukan" }, { status: 404 });

  if (event.status === "SETTLED" && payment.status !== "SETTLED") {
    await applySettlement(payment.id);
  } else if (event.status !== "SETTLED") {
    await db.payment.update({ where: { id: payment.id }, data: { status: event.status } });
  }
  return NextResponse.json({ ok: true });
}
