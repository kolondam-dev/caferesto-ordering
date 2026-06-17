import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { runBookingLifecycle } from "@/lib/lifecycle";

export async function GET() {
  await runBookingLifecycle();
  const tables = await db.table.findMany({
    orderBy: { number: "asc" },
    include: {
      bookings: {
        where: { status: { in: ["PENDING", "CONFIRMED", "SEATED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 1,
      },
      // Order aktif di meja: OPEN/PAID (jalur POS) atau IN_KITCHEN/
      // AWAITING_VALIDATION (jalur QR pay-first) — agar pesanan QR yang sedang
      // diproses tetap terlihat kasir (progres X/Y), tidak "nyangkut".
      orders: {
        where: { status: { in: ["OPEN", "PAID", "IN_KITCHEN", "AWAITING_VALIDATION"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, code: true, status: true, createdAt: true, items: { select: { status: true } } },
      },
    },
  });
  // Order aktif hanya relevan untuk meja yang sedang OCCUPIED. Setelah meja
  // dibersihkan (status OPEN) order PAID lama TIDAK lagi ditampilkan.
  const cleaned = tables.map((t) => ({
    ...t,
    orders: t.status === "OCCUPIED" ? t.orders : [],
  }));
  return NextResponse.json({ tables: cleaned });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const body = await req.json();
  const table = await db.table.create({
    data: { number: Number(body.number), name: body.name ?? `Meja ${body.number}`, capacity: Number(body.capacity ?? 4) },
  });
  return NextResponse.json({ table });
}
