import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getGuestId } from "@/lib/guest";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tautkan peserta guest (cookie) ke akun customer yang baru login/verifikasi —
 * dipanggil setelah OTP WA sukses di langkah bayar. Sejak tertaut, order ini
 * muncul di riwayat customer. Idempoten.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER")
    return NextResponse.json({ error: "Perlu login customer" }, { status: 401 });
  const gid = await getGuestId();
  if (!gid) return NextResponse.json({ error: "Sesi peserta tidak ditemukan" }, { status: 400 });

  const { id } = await ctx.params;
  const participant = await db.orderParticipant.findFirst({ where: { orderId: id, token: gid } });
  if (!participant) return NextResponse.json({ error: "Anda bukan peserta order ini" }, { status: 404 });

  await db.orderParticipant.update({
    where: { id: participant.id },
    data: { userId: session.sub, phone: participant.phone ?? session.phone ?? null },
  });
  // Host yang menautkan akun → order juga tercatat atas namanya.
  if (participant.isHost)
    await db.order.update({ where: { id }, data: { customerId: session.sub } });

  return NextResponse.json({ ok: true, linked: true });
}
