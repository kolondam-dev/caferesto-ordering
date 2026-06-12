/**
 * Verifikasi Cloudflare Turnstile (anti-bot) di sisi server.
 * TURNSTILE_SECRET_KEY kosong = fitur nonaktif (dev/CI) → selalu lolos,
 * sehingga lingkungan tanpa Turnstile tetap berfungsi tanpa perubahan.
 */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

export const TURNSTILE_ERROR = "Verifikasi keamanan gagal — muat ulang halaman lalu coba lagi.";
