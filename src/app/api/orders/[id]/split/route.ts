import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ORDER_STATUS, STAFF_ROLES } from "@/lib/constants";
import { getGateway } from "@/lib/payments";
import { applySettlement, getOrderDue } from "@/lib/payments/settle";
import { shortCode } from "@/lib/code";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.union([
  // Split rata: tagihan sisa dibagi N orang
  z.object({ mode: z.literal("even"), names: z.array(z.string().min(1)).min(2).max(20) }),
  // Split per item: tiap peserta menanggung item miliknya + pajak proporsional
  z.object({
    mode: z.literal("items"),
    shares: z.array(z.object({ name: z.string().min(1), itemIds: z.array(z.string()).min(1) })).min(1),
  }),
]);

/**
 * Split bill. Membuat satu Payment per peserta lewat gateway.
 * Mock gateway → semua langsung settle dan order tertutup bila lunas.
 */
async function handlePost(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data split tidak valid" }, { status: 400 });

  const { order, due, total } = await getOrderDue(id);
  if (order.status !== ORDER_STATUS.OPEN)
    return NextResponse.json({ error: "Order sudah ditutup" }, { status: 400 });
  if (due <= 0) return NextResponse.json({ error: "Tagihan sudah lunas" }, { status: 400 });
  if (!STAFF_ROLES.includes(guard.role) && order.customerId && order.customerId !== guard.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let shares: { name: string; amount: number }[] = [];

  if (parsed.data.mode === "even") {
    const n = parsed.data.names.length;
    const base = Math.floor(due / n);
    shares = parsed.data.names.map((name, i) => ({
      name,
      amount: i === 0 ? due - base * (n - 1) : base, // sisa pembulatan ke peserta pertama
    }));
  } else {
    const activeItems = order.items.filter((i) => i.status !== "CANCELED");
    const claimed = new Set<string>();
    // Pajak & deposit dibagi proporsional terhadap nilai item yang ditanggung
    const itemsValue = activeItems.reduce((s, i) => s + i.price * i.qty, 0);
    for (const share of parsed.data.shares) {
      let shareValue = 0;
      for (const itemId of share.itemIds) {
        if (claimed.has(itemId))
          return NextResponse.json({ error: "Item yang sama dipilih dua peserta" }, { status: 400 });
        const item = activeItems.find((i) => i.id === itemId);
        if (!item) return NextResponse.json({ error: "Item tidak ditemukan di order" }, { status: 400 });
        claimed.add(itemId);
        shareValue += item.price * item.qty;
      }
      const amount = itemsValue > 0 ? Math.round((shareValue / itemsValue) * due) : 0;
      shares.push({ name: share.name, amount });
    }
    // Koreksi pembulatan bila semua item terklaim
    if (claimed.size === activeItems.length) {
      const sum = shares.reduce((s, x) => s + x.amount, 0);
      shares[0].amount += due - sum;
    }
  }

  const gateway = getGateway();
  const payments = [];
  for (const share of shares) {
    if (share.amount <= 0) continue;
    const ref = shortCode("PAY", 8);
    const charge = await gateway.createCharge({
      ref,
      amount: share.amount,
      description: `Split bill ${order.code} — ${share.name}`,
      customer: { name: share.name },
    });
    const payment = await db.payment.create({
      data: {
        ref,
        provider: gateway.name,
        method: "gateway",
        purpose: "SPLIT",
        status: charge.status,
        amount: share.amount,
        orderId: id,
        payerName: share.name,
        meta: JSON.stringify({ providerRef: charge.providerRef, redirectUrl: charge.redirectUrl }),
      },
    });
    if (charge.status === "SETTLED") await applySettlement(payment.id);
    payments.push({ ...payment, redirectUrl: charge.redirectUrl });
  }

  const result = await getOrderDue(id);
  return NextResponse.json({ payments, bill: { total, due: result.due }, orderStatus: result.order.status });
}

// Aksi tulis kritis: retry client di-dedup lewat X-Idempotency-Key
export const POST = (req: NextRequest, ctx: Ctx) => withIdempotency(req, () => handlePost(req, ctx));
