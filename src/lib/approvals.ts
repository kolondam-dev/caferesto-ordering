import { db } from "./db";
import type { Session } from "./auth";
import { ORDER_STATUS, ITEM_STATUS, TABLE_STATUS } from "./constants";

export type ApprovalType = "ORDER_CANCEL" | "ORDER_DELETE" | "MENU_UPDATE" | "MENU_DELETE";

/** Owner mengeksekusi langsung; peran lain butuh persetujuan owner. */
export function needsApproval(role: string) {
  return role !== "OWNER";
}

/** Catat permintaan persetujuan (status PENDING). */
export async function createApproval(params: {
  type: ApprovalType;
  actor: Session;
  targetType: "ORDER" | "MENU";
  targetId: string;
  targetLabel?: string | null;
  reason?: string | null;
  payload?: unknown;
}) {
  return db.approvalRequest.create({
    data: {
      type: params.type,
      requestedById: params.actor.sub,
      requestedName: params.actor.name,
      targetType: params.targetType,
      targetId: params.targetId,
      targetLabel: params.targetLabel ?? null,
      reason: params.reason ?? null,
      payload: JSON.stringify(params.payload ?? {}),
    },
  });
}

// ───────── Mutasi (dipakai jalur owner-langsung & saat approve) ─────────

/** Batalkan order OPEN: tandai CANCELED, batalkan item belum tersaji, bebaskan meja. */
export async function cancelOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== ORDER_STATUS.OPEN) return { ok: false, error: "Order tidak bisa dibatalkan" };
  const tx = [
    db.order.update({ where: { id: orderId }, data: { status: ORDER_STATUS.CANCELED, closedAt: new Date() } }),
    db.orderItem.updateMany({ where: { orderId, status: { not: ITEM_STATUS.SERVED } }, data: { status: ITEM_STATUS.CANCELED } }),
  ];
  if (order.tableId)
    tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
  await db.$transaction(tx);
  return { ok: true };
}

/** Hapus order beserta turunannya (item, pembayaran, peserta) & bebaskan meja. */
export async function deleteOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order tidak ditemukan" };
  const tx = [
    db.payment.deleteMany({ where: { orderId } }),
    db.orderItem.deleteMany({ where: { orderId } }),
    db.orderParticipant.deleteMany({ where: { orderId } }),
    db.order.delete({ where: { id: orderId } }),
  ];
  if (order.tableId && order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.CANCELED)
    tx.push(db.table.update({ where: { id: order.tableId }, data: { status: TABLE_STATUS.OPEN } }) as never);
  await db.$transaction(tx);
  return { ok: true };
}

const MENU_FIELDS = ["name", "description", "price", "available", "categoryId", "prepMinutes", "costPrice"] as const;

/** Terapkan perubahan field menu (mapping sama dengan PATCH menu). */
export async function applyMenuUpdate(id: string, body: Record<string, unknown>) {
  return db.menuItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.description !== undefined && { description: body.description as string | null }),
      ...(body.price !== undefined && { price: Number(body.price) }),
      ...(body.available !== undefined && { available: Boolean(body.available) }),
      ...(body.categoryId !== undefined && { categoryId: String(body.categoryId) }),
      ...(body.prepMinutes !== undefined && { prepMinutes: body.prepMinutes ? Number(body.prepMinutes) : null }),
      ...(body.costPrice !== undefined && { costPrice: Math.max(0, Math.round(Number(body.costPrice) || 0)) }),
    },
  });
}

export function pickMenuFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of MENU_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

/** Hapus menu; bila pernah dipakai order, arsipkan (set tidak tersedia). */
export async function deleteMenuItem(id: string): Promise<{ archived?: boolean; deleted?: boolean }> {
  const used = await db.orderItem.count({ where: { menuItemId: id } });
  if (used > 0) {
    await db.menuItem.update({ where: { id }, data: { available: false } });
    return { archived: true };
  }
  await db.menuItem.delete({ where: { id } });
  return { deleted: true };
}

/** Jalankan efek dari sebuah permintaan yang disetujui. */
export async function applyApproval(req: {
  type: string;
  targetId: string;
  payload: string;
}): Promise<{ ok: boolean; error?: string }> {
  switch (req.type) {
    case "ORDER_CANCEL":
      return cancelOrder(req.targetId);
    case "ORDER_DELETE":
      return deleteOrder(req.targetId);
    case "MENU_UPDATE": {
      const body = safeJson(req.payload);
      await applyMenuUpdate(req.targetId, body);
      return { ok: true };
    }
    case "MENU_DELETE":
      await deleteMenuItem(req.targetId);
      return { ok: true };
    default:
      return { ok: false, error: "Tipe permintaan tidak dikenal" };
  }
}

export function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
