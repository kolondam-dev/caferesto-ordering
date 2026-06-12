import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";

/** Antrian kitchen: item aktif dari order yang masih OPEN, urut waktu masuk. */
export async function GET() {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;

  // Filter cukup di level item: item aktif harus tetap tampil walau ordernya
  // sudah dibayar lebih dulu di kasir (PAID). Order batal/void meng-CANCEL
  // itemnya, dan item QR sebelum validasi masih DRAFT — keduanya otomatis
  // tersaring oleh status item.
  const items = await db.orderItem.findMany({
    where: { status: { in: ["QUEUED", "PREPARING", "READY"] } },
    orderBy: { createdAt: "asc" },
    include: { order: { include: { table: true } } },
  });
  return NextResponse.json({ items });
}
