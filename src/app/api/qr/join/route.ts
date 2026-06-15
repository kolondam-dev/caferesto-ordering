import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { db } from "@/lib/db";
import { getGuestId, newGuestId, signGuestToken, GUEST_COOKIE } from "@/lib/guest";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { shortCode } from "@/lib/code";
import { ORDER_STATUS } from "@/lib/constants";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";

const schema = z.union([
  // Join baru: isi nama (+ HP opsional)
  z.object({ code: z.string(), name: z.string().min(1).max(40), phone: z.string().max(20).optional() }),
  // Klaim identitas lama (cookie hilang / ganti device): pilih nama yang sudah join
  z.object({ code: z.string(), claimParticipantId: z.string() }),
]);

/**
 * POST /api/qr/join — buat/gabung draft order kolaboratif di sebuah meja.
 * Pemindai pertama menjadi host; berikutnya menjadi member.
 * Tanpa login: identitas guest disimpan di cookie (JWT).
 */
async function handlePost(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Anti-bot hanya untuk join baru; klaim identitas (peserta sudah ada) dilewatkan
  if (!("claimParticipantId" in raw) && !(await verifyTurnstile(raw.turnstileToken as string | undefined)))
    return NextResponse.json({ error: TURNSTILE_ERROR }, { status: 403 });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  const table = await db.table.findUnique({ where: { code: parsed.data.code } });
  if (!table) return NextResponse.json({ error: "Meja tidak ditemukan" }, { status: 404 });

  const gid = (await getGuestId()) ?? newGuestId();
  // Bila customer sudah login, peserta langsung tertaut ke akunnya (story 3):
  // riwayat otomatis tersimpan, dan saat bayar tak perlu isi HP lagi.
  const session = await getSession();
  const linkUserId = session?.role === "CUSTOMER" ? session.sub : null;
  const linkPhone = session?.role === "CUSTOMER" ? session.phone ?? null : null;

  let order = await db.order.findFirst({
    where: { tableId: table.id, source: "QR", status: ORDER_STATUS.DRAFT },
    include: { participants: true },
  });

  let participantId: string;

  if ("claimParticipantId" in parsed.data) {
    const claimId = parsed.data.claimParticipantId;
    const target = order?.participants.find((p) => p.id === claimId);
    if (!order || !target)
      return NextResponse.json({ error: "Peserta tidak ditemukan di order aktif" }, { status: 404 });
    const alreadyMe = order.participants.find((p) => p.token === gid);
    if (alreadyMe) {
      // Device ini sudah punya identitas di order ini — jangan bajak peserta lain
      participantId = alreadyMe.id;
    } else {
      await db.orderParticipant.update({ where: { id: target.id }, data: { token: gid } });
      participantId = target.id;
    }
  } else {
    const { name, phone } = parsed.data;
    if (!order) {
      const settings = await getSettings();
      order = await db.order.create({
        data: {
          code: shortCode("ORD"),
          type: "DINE_IN",
          status: ORDER_STATUS.DRAFT,
          source: "QR",
          tableId: table.id,
          customerName: name,
          taxPercent: settings.taxPercent,
          serviceFeeType: settings.serviceFeeEnabled ? settings.serviceFeeType : null,
          serviceFeeValue: settings.serviceFeeEnabled ? settings.serviceFeeValue : 0,
          customerId: linkUserId,
          participants: { create: { name, phone: phone || linkPhone, isHost: true, token: gid, userId: linkUserId } },
        },
        include: { participants: true },
      });
      participantId = order.participants[0].id;
    } else {
      const existing = order.participants.find((p) => p.token === gid);
      if (existing) {
        participantId = existing.id; // device sama scan ulang — jangan duplikat
      } else {
        const participant = await db.orderParticipant.create({
          data: { orderId: order.id, name, phone: phone || linkPhone, token: gid, userId: linkUserId },
        });
        participantId = participant.id;
      }
      await db.order.update({ where: { id: order.id }, data: { lastActivityAt: new Date() } });
    }
  }

  const res = NextResponse.json({ orderId: order.id, participantId }, { status: 201 });
  res.cookies.set(GUEST_COOKIE, await signGuestToken(gid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}

// Catatan: pada replay, Set-Cookie tidak ikut — pemulihan identitas tetap bisa lewat tombol klaim nama di halaman scan
export const POST = (req: NextRequest) => withIdempotency(req, () => handlePost(req));
