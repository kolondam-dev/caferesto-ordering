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
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const mineOnly = !STAFF_ROLES.includes(guard.role);
  const orders = await db.order.findMany({
    where: { ...(status ? { status } : {}), ...(mineOnly ? { customerId: guard.sub } : {}) },
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
          tableId: booking.tableId,
          bookingId: booking.id,
          customerId: booking.customerId,
          depositApplied: booking.feeAmount, // booking fee jadi deposit tagihan
          taxPercent: settings.taxPercent,
        },
      }),
      db.booking.update({ where: { id: booking.id }, data: { status: BOOKING_STATUS.SEATED } }),
      db.table.update({ where: { id: booking.tableId }, data: { status: TABLE_STATUS.OCCUPIED } }),
    ]);
    return NextResponse.json({ order }, { status: 201 });
  }

  const type = body.type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN";
  let tableId: string | null = null;
  if (type === "DINE_IN") {
    const table = await db.table.findUnique({ where: { id: body.tableId ?? "" } });
    if (!table) return NextResponse.json({ error: "Pilih meja untuk dine-in" }, { status: 400 });
    const existing = await db.order.findFirst({ where: { tableId: table.id, status: ORDER_STATUS.OPEN } });
    if (existing) return NextResponse.json({ order: existing });
    if (table.status === TABLE_STATUS.BOOKED && !STAFF_ROLES.includes(guard.role))
      return NextResponse.json({ error: "Meja sedang dibooking" }, { status: 409 });
    tableId = table.id;
  }

  const order = await db.order.create({
    data: {
      code: shortCode("ORD"),
      type,
      tableId,
      customerId: guard.role === "CUSTOMER" ? guard.sub : null,
      customerName: body.customerName ?? guard.name,
      taxPercent: settings.taxPercent,
    },
  });
  if (tableId) await db.table.update({ where: { id: tableId }, data: { status: TABLE_STATUS.OCCUPIED } });
  return NextResponse.json({ order }, { status: 201 });
}
