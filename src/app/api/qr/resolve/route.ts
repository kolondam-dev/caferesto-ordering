import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGuestId } from "@/lib/guest";
import { ORDER_STATUS } from "@/lib/constants";

/**
 * Resolusi QR meja: GET /api/qr/resolve?code=...
 * Mengembalikan info meja, draft aktif (bila ada) beserta nama peserta,
 * dan participantId milik pemanggil bila device-nya sudah pernah join.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Kode meja kosong" }, { status: 400 });

  const table = await db.table.findUnique({ where: { code } });
  if (!table) return NextResponse.json({ error: "Meja tidak ditemukan" }, { status: 404 });

  const order = await db.order.findFirst({
    where: { tableId: table.id, source: "QR", status: ORDER_STATUS.DRAFT },
    include: { participants: { orderBy: { joinedAt: "asc" } } },
  });

  const gid = await getGuestId();
  const me = order && gid ? order.participants.find((p) => p.token === gid) : null;

  return NextResponse.json({
    table: { id: table.id, name: table.name, capacity: table.capacity },
    order: order
      ? {
          id: order.id,
          code: order.code,
          participants: order.participants.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost })),
        }
      : null,
    myParticipantId: me?.id ?? null,
  });
}
