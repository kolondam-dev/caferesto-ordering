import { db } from "./db";
import { getSettings } from "./settings";
import { ITEM_STATUS, ORDER_STATUS, TABLE_STATUS, orderTotal } from "./constants";

/**
 * Mesin alur Scan & Serve (pay-first):
 * AWAITING_PAYMENT → (lunas) → AWAITING_VALIDATION → (kasir) → IN_KITCHEN → PAID.
 */

export type Share = { participantId: string; name: string; subtotal: number; amount: number; settled: boolean };

/**
 * Rincian tagihan per member aktif (K3/K6): item miliknya + porsi service fee &
 * pajak proporsional. Koreksi pembulatan ditambahkan ke share terbesar agar
 * total share = total tagihan persis.
 */
export async function computeShares(orderId: string): Promise<Share[]> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, participants: { orderBy: { joinedAt: "asc" } }, payments: true },
  });
  const activeItems = order.items.filter((i) => i.status !== ITEM_STATUS.CANCELED);
  const { subtotal, total } = orderTotal(activeItems, order.taxPercent, {
    type: order.serviceFeeType,
    value: order.serviceFeeValue,
  });
  if (subtotal === 0) return [];

  const shares: Share[] = order.participants
    .map((p) => {
      const own = activeItems
        .filter((i) => i.participantId === p.id)
        .reduce((s, i) => s + i.price * i.qty, 0);
      return {
        participantId: p.id,
        name: p.name,
        subtotal: own,
        amount: Math.round((own / subtotal) * total),
        settled: order.payments.some((x) => x.participantId === p.id && x.status === "SETTLED"),
      };
    })
    .filter((s) => s.subtotal > 0);

  // Item tanpa atribusi (mis. ditambahkan staff) dibebankan ke host
  const unassigned = activeItems
    .filter((i) => !i.participantId || !shares.some((s) => s.participantId === i.participantId))
    .reduce((s, i) => s + i.price * i.qty, 0);
  if (unassigned > 0) {
    const host = order.participants.find((p) => p.isHost);
    if (host) {
      let share = shares.find((s) => s.participantId === host.id);
      if (!share) {
        share = {
          participantId: host.id,
          name: host.name,
          subtotal: 0,
          amount: 0,
          settled: order.payments.some((x) => x.participantId === host.id && x.status === "SETTLED"),
        };
        shares.push(share);
      }
      share.subtotal += unassigned;
      share.amount += Math.round((unassigned / subtotal) * total);
    }
  }

  // Koreksi pembulatan
  const diff = total - shares.reduce((s, x) => s + x.amount, 0);
  if (diff !== 0 && shares.length > 0) {
    shares.reduce((a, b) => (b.amount > a.amount ? b : a)).amount += diff;
  }
  return shares;
}

/** Order QR lunas → antrian validasi kasir, atau langsung dapur bila validasi OFF. */
export async function moveToValidationOrKitchen(orderId: string) {
  const settings = await getSettings();
  if (settings.requireCashierValidation) {
    await db.order.update({
      where: { id: orderId },
      data: { status: ORDER_STATUS.AWAITING_VALIDATION, lastActivityAt: new Date() },
    });
    return ORDER_STATUS.AWAITING_VALIDATION;
  }
  await enterKitchen(orderId);
  return ORDER_STATUS.IN_KITCHEN;
}

/** Kirim order QR ke dapur: item DRAFT → QUEUED, meja OCCUPIED. */
export async function enterKitchen(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const tx = [
    db.order.update({
      where: { id: orderId },
      data: { status: ORDER_STATUS.IN_KITCHEN, lastActivityAt: new Date() },
    }),
    db.orderItem.updateMany({
      where: { orderId, status: ITEM_STATUS.DRAFT },
      data: { status: ITEM_STATUS.QUEUED },
    }),
  ];
  if (order.tableId)
    tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OCCUPIED } }) as never);
  await db.$transaction(tx);
}

/** Setelah semua item tersaji, order QR ditutup dan meja dibebaskan. */
export async function completeIfAllServed(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.status !== ORDER_STATUS.IN_KITCHEN) return false;
  const active = order.items.filter((i) => i.status !== ITEM_STATUS.CANCELED);
  if (active.length === 0 || !active.every((i) => i.status === ITEM_STATUS.SERVED)) return false;

  const tx = [
    db.order.update({
      where: { id: orderId },
      data: { status: ORDER_STATUS.PAID, closedAt: new Date() },
    }),
  ];
  if (order.tableId)
    tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
  await db.$transaction(tx);
  return true;
}
