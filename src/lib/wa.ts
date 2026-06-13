/**
 * Abstraksi pengiriman WhatsApp (OTP & notifikasi).
 * MOCK: hanya mencatat ke log dan mengembalikan sukses. Untuk produksi,
 * ganti isi sendWhatsApp dengan panggilan ke WhatsApp Business API / BSP
 * (Twilio, Qiscus, dsb.) — pemanggil tidak perlu berubah.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  // TODO(produksi): integrasi WA Business API di sini.
  console.log(`[WA mock] → ${phone}: ${message}`);
}

/** Normalisasi nomor Indonesia ke format 62xxxxxxxxxx. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^0-9]/g, "");
  let n = d;
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  else if (!n.startsWith("62") && n.startsWith("620")) n = "62" + n.slice(3);
  if (!n.startsWith("62") || n.length < 10 || n.length > 15) return null;
  return n;
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
