import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendWhatsApp, normalizePhone, generateOtp } from "@/lib/wa";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";

const schema = z.object({
  name: z.string().min(2).max(40),
  phone: z.string().min(8).max(20),
  turnstileToken: z.string().optional(),
});

const OTP_TTL_MIN = 10;

/**
 * Minta OTP login customer via WhatsApp. Mock: OTP dikirim lewat sendWhatsApp
 * (log) dan, di luar production, dikembalikan di field devCode untuk memudahkan
 * pengetesan tanpa WA asli.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyTurnstile(raw.turnstileToken as string | undefined)))
    return NextResponse.json({ error: TURNSTILE_ERROR }, { status: 403 });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Nama & no HP wajib diisi" }, { status: 400 });

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Format no HP tidak valid" }, { status: 400 });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
  await db.waOtp.upsert({
    where: { phone },
    update: { code, name: parsed.data.name, expiresAt, attempts: 0 },
    create: { phone, code, name: parsed.data.name, expiresAt },
  });

  await sendWhatsApp(phone, `Kode masuk CafeResto Anda: ${code} (berlaku ${OTP_TTL_MIN} menit). Jangan bagikan ke siapa pun.`);

  const isProd = process.env.NODE_ENV === "production" && process.env.WA_LIVE === "1";
  return NextResponse.json({
    sent: true,
    phone,
    // Hanya untuk dev/mock — di production WA asli, devCode tidak dikirim.
    ...(isProd ? {} : { devCode: code }),
  });
}
