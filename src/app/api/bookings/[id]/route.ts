import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES, BOOKING_STATUS, STAFF_ROLES, TABLE_STATUS } from "@/lib/constants";
import { runBookingLifecycle } from "@/lib/lifecycle";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  await runBookingLifecycle();
  const { id } = await ctx.params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { table: true, customer: { select: { name: true } }, order: true, payments: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  if (!STAFF_ROLES.includes(guard.role) && booking.customerId !== guard.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ booking });
}

/** Pembatalan manual (customer pemilik booking atau admin). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });

  const isOwner = booking.customerId === guard.sub;
  const isAdmin = ADMIN_ROLES.includes(guard.role) || guard.role === "CASHIER";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (body.action === "cancel") {
    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.status as never))
      return NextResponse.json({ error: "Booking tidak bisa dibatalkan" }, { status: 400 });
    const tx = [
      db.booking.update({
        where: { id },
        data: { status: BOOKING_STATUS.CANCELED, canceledReason: body.reason ?? "Dibatalkan manual" },
      }),
    ];
    if (booking.status === BOOKING_STATUS.CONFIRMED)
      tx.push(db.table.update({ where: { id: booking.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
    await db.$transaction(tx);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
