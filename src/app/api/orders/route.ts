import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { BOOKING_STATUS, ORDER_STATUS, STAFF_ROLES, TABLE_STATUS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { runBookingLifecycle } from "@/lib/lifecycle";
import { shortCode } from "@/lib/code";

export async function GET(req: NextRequest) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;

  // ?attention=1 → draft QR yang mendekati TTL (reminder kasir, K4)
  if (req.nextUrl.searchParams.get("attention") === "1") {
    if (!STAFF_ROLES.includes(guard.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await runBookingLifecycle();
    const settings = await getSettings();
    const reminderMinutes = Math.max(1, settings.draftTtlMinutes - 5);
    const cutoff = new Date(Date.now() - reminderMinutes * 60_000);
    const orders = await db.order.findMany({
      where: { source: "QR", status: ORDER_STATUS.DRAFT, lastActivityAt: { lt: cutoff } },
      orderBy: { lastActivityAt: "asc" },
      include: { table: true, items: true, participants: { select: { name: true } } },
    });
    return NextResponse.json({ orders, ttlMinutes: settings.draftTtlMinutes });
  }

  // ?board=takeaway → papan takeaway aktif untuk kasir (OPEN, atau PAID yang
  // belum semua tersaji), terbaru di depan.
  if (req.nextUrl.searchParams.get("board") === "takeaway") {
    if (!STAFF_ROLES.includes(guard.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const list = await db.order.findMany({
      where: { type: "TAKEAWAY", status: { in: [ORDER_STATUS.OPEN, ORDER_STATUS.PAID] } },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { status: true } }, table: { select: { name: true } } },
      take: 50,
    });
    // Sembunyikan takeaway yang sudah lunas & seluruh itemnya tersaji (selesai)
    const orders = list.filter((o) => {
      if (o.status === ORDER_STATUS.OPEN) return true;
      const active = o.items.filter((i) => i.status !== "CANCELED");
      return active.length === 0 || !active.every((i) => i.status === "SERVED");
    });
    return NextResponse.json({ orders });
  }

  // ?board=handoff → order mandiri pelanggan yang menunggu diproses kasir
  if (req.nextUrl.searchParams.get("board") === "handoff") {
    if (!STAFF_ROLES.includes(guard.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const orders = await db.order.findMany({
      where: { handoff: "CASHIER", status: ORDER_STATUS.DRAFT },
      orderBy: { createdAt: "asc" },
      include: { items: { select: { nameSnapshot: true, qty: true, price: true, status: true } } },
      take: 50,
    });
    return NextResponse.json({ orders });
  }

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const mineOnly = !STAFF_ROLES.includes(guard.role);
  // Customer melihat order miliknya (customerId) ATAU order jalur QR tempat ia
  // menjadi peserta tertaut (participant.userId) — termasuk member yang bayar sendiri.
  const mineFilter = mineOnly
    ? { OR: [{ customerId: guard.sub }, { participants: { some: { userId: guard.sub } } }] }
    : {};
  const orders = await db.order.findMany({
    where: { ...(status ? { status } : {}), ...mineFilter },
    orderBy: { createdAt: "desc" },
    include: { table: true, items: true, booking: { select: { code: true } } },
    take: 100,
  });
  return NextResponse.json({ orders });
}

/**
 * Buka order baru. Tiga jalur:
 * - { bookingId }      → check-in booking CONFIRMED (deposit fee dikreditkan)
 * - { tableId, type }  → dine-in walk-in (staff/customer)
 * - { type:"TAKEAWAY" }
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  await runBookingLifecycle();

  const body = await req.json();
  const settings = await getSettings();

  if (body.bookingId) {
    const booking = await db.booking.findUnique({ where: { id: body.bookingId }, include: { order: true } });
    if (!booking) return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
    if (booking.order) return NextResponse.json({ order: booking.order });
    if (booking.status !== BOOKING_STATUS.CONFIRMED)
      return NextResponse.json(
        { error: `Booking berstatus ${booking.status} — hanya booking CONFIRMED yang bisa check-in` },
        { status: 400 }
      );
    if (booking.customerId !== guard.sub && !STAFF_ROLES.includes(guard.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [order] = await db.$transaction([
      db.order.create({
        data: {
          code: shortCode("ORD"),
          type: "DINE_IN",
          source: "BOOKING",
          tableId: booking.tableId,
          bookingId: booking.id,
          customerId: booking.customerId,
          depositApplied: booking.feeAmount, // booking fee jadi deposit tagihan
          taxPercent: settings.taxPercent,
          serviceFeeType: settings.serviceFeeEnabled ? settings.serviceFeeType : null,
          serviceFeeValue: settings.serviceFeeEnabled ? settings.serviceFeeValue : 0,
        },
      }),
      db.booking.update({ where: { id: booking.id }, data: { status: BOOKING_STATUS.SEATED } }),
      db.table.update({ where: { id: booking.tableId }, data: { status: TABLE_STATUS.OCCUPIED } }),
    ]);
    return NextResponse.json({ order }, { status: 201 });
  }

  const type = body.type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN";
  const CHANNELS = ["WALKIN", "DINEIN", "SHOPEEFOOD", "GOFOOD", "WA"];
  const channel = type === "TAKEAWAY" && CHANNELS.includes(body.channel) ? body.channel : type === "TAKEAWAY" ? "WALKIN" : null;

  let tableId: string | null = null;
  if (type === "DINE_IN") {
    const table = await db.table.findUnique({ where: { id: body.tableId ?? "" } });
    if (!table) return NextResponse.json({ error: "Pilih meja untuk dine-in" }, { status: 400 });
    // Order berjalan di meja: OPEN bisa dilanjutkan; jalur QR (AWAITING_*/IN_KITCHEN)
    // sedang diproses → cegah order kedua "berebut" meja yang sama.
    const running = await db.order.findFirst({
      where: { tableId: table.id, status: { in: [ORDER_STATUS.OPEN, ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.AWAITING_VALIDATION, ORDER_STATUS.IN_KITCHEN] } },
      orderBy: { createdAt: "desc" },
    });
    if (running?.status === ORDER_STATUS.OPEN) return NextResponse.json({ order: running });
    if (running)
      return NextResponse.json({ error: "Meja sedang memproses pesanan (QR). Tunggu selesai atau tutup sesi dulu." }, { status: 409 });
    if (table.status === TABLE_STATUS.BOOKED && !STAFF_ROLES.includes(guard.role))
      return NextResponse.json({ error: "Meja sedang dibooking" }, { status: 409 });
    tableId = table.id;
  } else if (channel === "DINEIN" && body.tableId) {
    // Takeaway "order tambahan dibungkus" untuk tamu yang sedang dine-in:
    // simpan referensi meja asal tanpa menduduki/menahan meja.
    const table = await db.table.findUnique({ where: { id: body.tableId } });
    if (table) tableId = table.id;
  }
  const order = await db.order.create({
    data: {
      code: shortCode("ORD"),
      type,
      tableId,
      customerId: guard.role === "CUSTOMER" ? guard.sub : null,
      customerName: body.customerName?.trim() || guard.name,
      customerPhone: type === "TAKEAWAY" ? (body.customerPhone?.trim() || null) : null,
      channel,
      taxPercent: settings.taxPercent,
      serviceFeeType: settings.serviceFeeEnabled ? settings.serviceFeeType : null,
      serviceFeeValue: settings.serviceFeeEnabled ? settings.serviceFeeValue : 0,
    },
  });
  // Hanya dine-in murni yang menduduki meja; takeaway "dibungkus dari meja"
  // hanya menyimpan referensi (meja tetap pada status dine-in tamu).
  if (tableId && type === "DINE_IN") await db.table.update({ where: { id: tableId }, data: { status: TABLE_STATUS.OCCUPIED } });
  return NextResponse.json({ order }, { status: 201 });
}
