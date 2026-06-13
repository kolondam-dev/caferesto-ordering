import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/wa";
import { signToken, AUTH_COOKIE, CUSTOMER_TOKEN_AGE } from "@/lib/auth";

const schema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().min(4).max(8),
});

/**
 * Verifikasi OTP WA → buat/login customer (identitas berbasis no HP),
 * lalu set cookie jangka panjang (90 hari) untuk device ini.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Format no HP tidak valid" }, { status: 400 });

  const otp = await db.waOtp.findUnique({ where: { phone } });
  if (!otp) return NextResponse.json({ error: "Minta kode OTP dulu" }, { status: 400 });
  if (otp.attempts >= 5) return NextResponse.json({ error: "Terlalu banyak percobaan — minta kode baru" }, { status: 429 });
  if (otp.expiresAt < new Date()) return NextResponse.json({ error: "Kode kedaluwarsa — minta kode baru" }, { status: 400 });
  if (otp.code !== parsed.data.code.trim()) {
    await db.waOtp.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Kode salah" }, { status: 400 });
  }

  // Upsert customer berdasarkan no HP
  const user = await db.user.upsert({
    where: { phone },
    update: { name: otp.name },
    create: { phone, name: otp.name, role: "CUSTOMER" },
  });
  await db.waOtp.delete({ where: { phone } }).catch(() => {});

  const token = await signToken(
    { sub: user.id, name: user.name, email: user.email ?? "", role: "CUSTOMER", phone },
    CUSTOMER_TOKEN_AGE
  );
  const res = NextResponse.json({ user: { id: user.id, name: user.name, phone, role: "CUSTOMER" } });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_TOKEN_AGE,
  });
  return res;
}
