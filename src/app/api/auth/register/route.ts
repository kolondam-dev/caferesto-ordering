import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { signToken, AUTH_COOKIE } from "@/lib/auth";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyTurnstile(raw.turnstileToken as string | undefined)))
    return NextResponse.json({ error: TURNSTILE_ERROR }, { status: 403 });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const { name, email, phone, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } }))
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });

  const user = await db.user.create({
    data: { name, email, phone, passwordHash: await bcrypt.hash(password, 10), role: "CUSTOMER" },
  });

  const token = await signToken({ sub: user.id, name: user.name, email: user.email ?? "", role: "CUSTOMER" });
  const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  res.cookies.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
  return res;
}
