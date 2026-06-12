import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const all = ADMIN_ROLES.includes(guard.role) && req.nextUrl.searchParams.get("all") === "1";
  const attendances = await db.attendance.findMany({
    where: all ? {} : { userId: guard.sub },
    orderBy: { clockIn: "desc" },
    include: { user: { select: { name: true, role: true } } },
    take: 100,
  });
  const open = await db.attendance.findFirst({ where: { userId: guard.sub, clockOut: null } });
  return NextResponse.json({ attendances, open });
}

/** action: "clock-in" | "clock-out" untuk user yang sedang login. */
export async function POST(req: NextRequest) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const { action, note } = (await req.json()) as { action?: string; note?: string };

  const open = await db.attendance.findFirst({ where: { userId: guard.sub, clockOut: null } });
  if (action === "clock-in") {
    if (open) return NextResponse.json({ error: "Masih ada shift terbuka" }, { status: 400 });
    const attendance = await db.attendance.create({ data: { userId: guard.sub, note } });
    return NextResponse.json({ attendance }, { status: 201 });
  }
  if (action === "clock-out") {
    if (!open) return NextResponse.json({ error: "Belum clock-in" }, { status: 400 });
    const attendance = await db.attendance.update({
      where: { id: open.id },
      data: { clockOut: new Date(), ...(note ? { note } : {}) },
    });
    return NextResponse.json({ attendance });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
