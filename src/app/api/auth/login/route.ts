import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, AUTH_COOKIE } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { verifyTurnstile, TURNSTILE_ERROR } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  const { email, password, turnstileToken } = (await req.json()) as {
    email?: string;
    password?: string;
    turnstileToken?: string;
  };
  if (!(await verifyTurnstile(turnstileToken)))
    return NextResponse.json({ error: TURNSTILE_ERROR }, { status: 403 });
  if (!email || !password)
    return NextResponse.json({ error: "Email & password wajib diisi" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });

  const token = await signToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  });
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  res.cookies.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
  return res;
}
