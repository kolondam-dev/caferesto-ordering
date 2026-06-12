import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Identitas guest (tanpa login) untuk jalur QR Scan & Serve.
 * Cookie berisi JWT { gid } — gid dipakai sebagai OrderParticipant.token
 * sehingga device yang sama dikenali kembali saat scan ulang.
 */

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
export const GUEST_COOKIE = "cr_guest";

export async function getGuestId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload as { gid?: string }).gid ?? null;
  } catch {
    return null;
  }
}

export function newGuestId() {
  return `g_${crypto.randomUUID()}`;
}

export async function signGuestToken(gid: string) {
  return new SignJWT({ gid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}
