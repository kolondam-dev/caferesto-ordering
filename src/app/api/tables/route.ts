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
      orders: { where: { status: "OPEN" }, take: 1 },
    },
  });
  return NextResponse.json({ tables });
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
