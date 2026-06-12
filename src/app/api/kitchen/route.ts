import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";

/** Antrian kitchen: item aktif dari order yang masih OPEN, urut waktu masuk. */
export async function GET() {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;

  const items = await db.orderItem.findMany({
    where: { status: { in: ["QUEUED", "PREPARING", "READY"] }, order: { status: "OPEN" } },
    orderBy: { createdAt: "asc" },
    include: { order: { include: { table: true } } },
  });
  return NextResponse.json({ items });
}
