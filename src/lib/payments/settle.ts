import { db } from "../db";
import { BOOKING_STATUS, ORDER_STATUS, TABLE_STATUS, orderTotal } from "../constants";

/**
 * Efek domain setelah sebuah Payment menjadi SETTLED.
 * Dipanggil dari endpoint pembayaran (mock settle instan) maupun webhook provider.
 */
export async function applySettlement(paymentId: string) {
  const payment = await db.payment.update({
    where: { id: paymentId },
    data: { status: "SETTLED", settledAt: new Date() },
    include: { booking: true, order: { include: { items: true, payments: true } } },
  });

  // Booking fee lunas → booking CONFIRMED, meja BOOKED
  if (payment.purpose === "BOOKING_FEE" && payment.booking) {
    if (payment.booking.status === BOOKING_STATUS.PENDING) {
      await db.$transaction([
        db.booking.update({
          where: { id: payment.booking.id },
          data: { status: BOOKING_STATUS.CONFIRMED, feePaidAt: new Date() },
        }),
        db.table.update({
          where: { id: payment.booking.tableId },
          data: { status: TABLE_STATUS.BOOKED },
        }),
      ]);
    }
    return payment;
  }

  // Pembayaran order (penuh atau split) → tutup order bila sudah lunas
  if (payment.order) {
    await closeOrderIfPaid(payment.order.id);
  }
  return payment;
}

export async function getOrderDue(orderId: string) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
  const { subtotal, tax, total } = orderTotal(order.items, order.taxPercent);
  const settled = order.payments
    .filter((p) => p.status === "SETTLED")
    .reduce((s, p) => s + p.amount, 0);
  const due = Math.max(0, total - order.depositApplied - settled);
  return { order, subtotal, tax, total, settled, deposit: order.depositApplied, due };
}

export async function closeOrderIfPaid(orderId: string) {
  const { order, due } = await getOrderDue(orderId);
  if (order.status !== ORDER_STATUS.OPEN || due > 0) return false;

  const tx = [
    db.order.update({
      where: { id: orderId },
      data: { status: ORDER_STATUS.PAID, closedAt: new Date() },
    }),
  ];
  if (order.tableId)
    tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
  if (order.bookingId)
    tx.push(
      db.booking.update({
        where: { id: order.bookingId },
        data: { status: BOOKING_STATUS.COMPLETED },
      }) as never
    );
  await db.$transaction(tx);
  return true;
}
