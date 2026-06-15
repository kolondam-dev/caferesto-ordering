import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { db } from "@/lib/db";
import { getGuestId, newGuestId, signGuestToken, GUEST_COOKIE } from "@/lib/guest";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { shortCode } from "@/lib/code";
import { ORDER_STATUS, ITEM_STATUS } from "@/lib/constants";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";

const schema = z.object({
  items: z.array(z.object({ menuItemId: z.string(), qty: z.number().int().min(1).max(99) })).min(1),
  type: z.enum(["DINE_IN", "TAKEAWAY"]).default("DINE_IN"),
  customerName: z.string().max(40).optional(),
  customerPhone: z.string().max(20).optional(),
  turnstileToken: z.string().optional(),
});

/**
 * Order mandiri pelanggan dari menu publik (tanpa login, tanpa meja): pelanggan
 * memilih menu di HP, lalu menunjukkan KODE order ke kasir. Kasir yang menetapkan
 * meja/takeaway & menerima pembayaran (cash/QRIS). Menyiasati kebingungan "scan
 * QR meja padahal tak duduk di situ".
 */
async function handlePost(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyTurnstile(raw.turnstileToken as string | undefined)))
    return NextResponse.json({ error: TURNSTILE_ERROR }, { status: 403 });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const { items, type, customerName, customerPhone } = parsed.data;

  // Validasi menu & ambil harga snapshot
  const ids = [...new Set(items.map((i) => i.menuItemId))];
  const menus = await db.menuItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(menus.map((m) => [m.id, m]));
  for (const it of items) {
    const m = byId.get(it.menuItemId);
    if (!m) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 400 });
    if (!m.available) return NextResponse.json({ error: `${m.name} sedang habis` }, { status: 400 });
  }

  const gid = (await getGuestId()) ?? newGuestId();
  const session = await getSession();
  const linkUserId = session?.role === "CUSTOMER" ? session.sub : null;
  const name = (customerName?.trim() || session?.name || "Tamu").slice(0, 40);
  const phone = customerPhone?.trim() || (session?.role === "CUSTOMER" ? session.phone ?? null : null);
  const settings = await getSettings();

  const order = await db.order.create({
    data: {
      code: shortCode("ORD"),
      type,
      status: ORDER_STATUS.DRAFT,
      source: "QR",
      handoff: "CASHIER",
      customerId: linkUserId,
      customerName: name,
      customerPhone: phone,
      taxPercent: settings.taxPercent,
      serviceFeeType: settings.serviceFeeEnabled ? settings.serviceFeeType : null,
      serviceFeeValue: settings.serviceFeeEnabled ? settings.serviceFeeValue : 0,
      participants: { create: { name, phone, isHost: true, token: gid, userId: linkUserId } },
    },
    include: { participants: true },
  });

  const participantId = order.participants[0].id;
  await db.orderItem.createMany({
    data: items.map((it) => {
      const m = byId.get(it.menuItemId)!;
      return {
        orderId: order.id,
        menuItemId: m.id,
        participantId,
        nameSnapshot: m.name,
        price: m.price,
        qty: it.qty,
        status: ITEM_STATUS.DRAFT,
      };
    }),
  });

  const res = NextResponse.json({ orderId: order.id, code: order.code }, { status: 201 });
  res.cookies.set(GUEST_COOKIE, await signGuestToken(gid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}

export const POST = (req: NextRequest) => withIdempotency(req, () => handlePost(req));
