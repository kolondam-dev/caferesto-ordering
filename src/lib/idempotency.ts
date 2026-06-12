import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

/**
 * Lapis resiliensi sisi server: bila client mengirim X-Idempotency-Key,
 * eksekusi pertama disimpan dan request ulangan (auto-retry setelah koneksi
 * putus) mendapat replay respons yang sama — mencegah item/pembayaran ganda.
 */
export async function withIdempotency(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const key = req.headers.get("x-idempotency-key");
  if (!key || key.length > 100) return handler();

  const existing = await db.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    return new NextResponse(existing.body, {
      status: existing.status,
      headers: { "Content-Type": "application/json", "X-Idempotent-Replay": "1" },
    });
  }

  const res = await handler();
  // Simpan hanya hasil final (bukan 5xx) agar retry error server tetap dieksekusi ulang
  if (res.status < 500) {
    const body = await res.clone().text();
    await db.idempotencyKey
      .create({ data: { key, status: res.status, body } })
      .catch(() => {}); // race dua request paralel: biarkan yang pertama menang
  }
  return res;
}
