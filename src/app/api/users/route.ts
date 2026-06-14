import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { STAFF_ROLES } from "@/lib/constants";

/** Daftar pengguna staf (untuk manajemen peran). Butuh izin users.manage. */
export async function GET() {
  const guard = await requirePermission("users.manage");
  if (!isSession(guard)) return guard;

  const users = await db.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ users });
}
