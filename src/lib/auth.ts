import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "./constants";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
export const AUTH_COOKIE = "cr_token";

export type Session = { sub: string; name: string; email: string; role: Role; phone?: string };

export const STAFF_TOKEN_AGE = 7 * 86400; // 7 hari
export const CUSTOMER_TOKEN_AGE = 90 * 86400; // 90 hari — customer cookie jangka panjang

export async function signToken(payload: Session, expiresInSeconds = STAFF_TOKEN_AGE) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Guard untuk route handler. Mengembalikan session atau NextResponse 401/403. */
export async function requireRole(roles?: Role[]): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (roles && !roles.includes(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return session;
}

export function isSession(x: Session | NextResponse): x is Session {
  return !(x instanceof NextResponse);
}
