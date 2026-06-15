import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGuestId } from "@/lib/guest";
import { getSession } from "@/lib/auth";
import { ORDER_STATUS } from "@/lib/constants";
import { runBookingLifecycle } from "@/lib/lifecycle";

const LOCKED_STATUSES = [
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.AWAITING_VALIDATION,
  ORDER_STATUS.IN_KITCHEN,
];

/**
 * Resolusi QR meja: GET /api/qr/resolve?code=...
 * - draft aktif → bisa di-join
 * - order terkunci (bayar/validasi/dapur) → peserta diarahkan kembali ke ordernya;
 *   pemindai baru ditawari memulai ronde baru (draft baru di meja yang sama)
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Kode meja kosong" }, { status: 400 });

  const table = await db.table.findUnique({ where: { code } });
  if (!table) return NextResponse.json({ error: "Meja tidak ditemukan" }, { status: 404 });

  await runBookingLifecycle(); // kedaluwarsakan draft basi sebelum resolusi

  const [gid, session] = await Promise.all([getGuestId(), getSession()]);
  // Customer yang sudah login dikenali → sapa namanya, lewati isian HP.
  const viewer = session?.role === "CUSTOMER" ? { name: session.name } : null;
  const [draft, locked] = await Promise.all([
    db.order.findFirst({
      where: { tableId: table.id, source: "QR", status: ORDER_STATUS.DRAFT },
      include: { participants: { orderBy: { joinedAt: "asc" } } },
    }),
    db.order.findFirst({
      where: { tableId: table.id, source: "QR", status: { in: LOCKED_STATUSES } },
      orderBy: { createdAt: "desc" },
      include: { participants: true },
    }),
  ]);

  const meInDraft = draft && gid ? draft.participants.find((p) => p.token === gid) : null;
  const meInLocked = locked && gid ? locked.participants.find((p) => p.token === gid) : null;

  return NextResponse.json({
    table: { id: table.id, name: table.name, capacity: table.capacity },
    order: draft
      ? {
          id: draft.id,
          code: draft.code,
          participants: draft.participants.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost })),
        }
      : null,
    lockedOrder: locked ? { id: locked.id, code: locked.code, status: locked.status } : null,
    myParticipantId: meInDraft?.id ?? null,
    myLockedOrderId: meInLocked ? locked!.id : null,
    viewer,
  });
}
