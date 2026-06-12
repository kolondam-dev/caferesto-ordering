import { db } from "./db";
import { getSession, type Session } from "./auth";
import { getGuestId } from "./guest";
import { STAFF_ROLES } from "./constants";
import type { OrderParticipant } from "@prisma/client";

export type OrderAccess = {
  session: Session | null;
  participant: OrderParticipant | null;
  isStaff: boolean;
  /** boleh melihat & menambah item */
  canAccess: boolean;
  /** kontrol penuh atas order (staff, pemilik akun, atau host QR) */
  isController: boolean;
};

/**
 * Resolusi hak akses sebuah order untuk pemanggil saat ini —
 * mendukung tiga identitas: staff (JWT login), customer pemilik order (JWT login),
 * dan guest peserta QR (cookie guest).
 */
export async function resolveOrderAccess(order: {
  id: string;
  customerId: string | null;
  source: string;
}): Promise<OrderAccess> {
  const [session, gid] = await Promise.all([getSession(), getGuestId()]);

  const participant =
    gid && order.source === "QR"
      ? await db.orderParticipant.findFirst({ where: { orderId: order.id, token: gid } })
      : null;

  const isStaff = !!session && STAFF_ROLES.includes(session.role);
  const isOwnerCustomer = !!session && !!order.customerId && order.customerId === session.sub;
  const canAccess = isStaff || isOwnerCustomer || !!participant || (!order.customerId && order.source !== "QR" && !!session);

  return {
    session,
    participant,
    isStaff,
    canAccess,
    isController: isStaff || isOwnerCustomer || !!participant?.isHost,
  };
}
