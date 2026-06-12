import { db } from "./db";
import { getSettings } from "./settings";
import { BOOKING_STATUS, TABLE_STATUS } from "./constants";

/**
 * Mesin lifecycle booking. Dipanggil secara opportunistik dari endpoint
 * booking/table/order dan dari /api/lifecycle (bisa di-cron).
 *
 * 1. PENDING yang melewati payDeadlineAt (H-x) tanpa bayar fee → EXPIRED, meja tetap OPEN.
 * 2. CONFIRMED yang melewati scheduledAt + graceMinutes tanpa order dibuka
 *    → CANCELED, meja kembali OPEN.
 */
export async function runBookingLifecycle() {
  const now = new Date();
  const settings = await getSettings();
  let expired = 0;
  let canceled = 0;

  const pendingLate = await db.booking.findMany({
    where: { status: BOOKING_STATUS.PENDING, payDeadlineAt: { lt: now } },
  });
  for (const b of pendingLate) {
    await db.booking.update({
      where: { id: b.id },
      data: {
        status: BOOKING_STATUS.EXPIRED,
        canceledReason: `Booking fee tidak dibayar sebelum batas H-${settings.bookingConfirmDays}`,
      },
    });
    expired++;
  }

  const graceMs = settings.bookingGraceMinutes * 60_000;
  const confirmedLate = await db.booking.findMany({
    where: {
      status: BOOKING_STATUS.CONFIRMED,
      scheduledAt: { lt: new Date(now.getTime() - graceMs) },
      order: null,
    },
  });
  for (const b of confirmedLate) {
    await db.$transaction([
      db.booking.update({
        where: { id: b.id },
        data: {
          status: BOOKING_STATUS.CANCELED,
          canceledReason: `Tidak ada order dalam ${settings.bookingGraceMinutes} menit setelah jadwal`,
        },
      }),
      db.table.update({ where: { id: b.tableId }, data: { status: TABLE_STATUS.OPEN } }),
    ]);
    canceled++;
  }

  return { expired, canceled };
}
