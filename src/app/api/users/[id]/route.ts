import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { STAFF_ROLES, type Role } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/** Tetapkan peran staf ke pengguna. Butuh izin users.manage. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("users.manage");
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role = body.role as Role | undefined;

  if (!role || !STAFF_ROLES.includes(role))
    return NextResponse.json({ error: "Peran tidak valid" }, { status: 400 });

  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });

  // Jangan ubah peran diri sendiri (hindari mengunci akses sendiri).
  if (id === guard.sub)
    return NextResponse.json({ error: "Tidak bisa mengubah peran sendiri" }, { status: 400 });

  // Jangan turunkan OWNER terakhir.
  if (target.role === "OWNER" && role !== "OWNER") {
    const owners = await db.user.count({ where: { role: "OWNER" } });
    if (owners <= 1)
      return NextResponse.json({ error: "Minimal harus ada satu OWNER" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ user });
}
