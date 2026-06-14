import { NextRequest, NextResponse } from "next/server";
import { isSession } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { setGrants, resetGrants, requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ role: string }> };

function validRole(role: string): role is Role {
  return STAFF_ROLES.includes(role as Role) && role !== "OWNER";
}

/** Simpan grant izin sebuah peran. Butuh izin roles.manage. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("roles.manage");
  if (!isSession(guard)) return guard;
  const { role } = await ctx.params;
  if (!validRole(role))
    return NextResponse.json({ error: "Peran tidak dapat diubah" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { permissions?: string[] };
  if (!Array.isArray(body.permissions))
    return NextResponse.json({ error: "permissions harus array" }, { status: 400 });

  const grants = await setGrants(role, body.permissions);
  return NextResponse.json({ role, grants });
}

/** Reset peran ke grant default. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("roles.manage");
  if (!isSession(guard)) return guard;
  const { role } = await ctx.params;
  if (!validRole(role))
    return NextResponse.json({ error: "Peran tidak dapat diubah" }, { status: 400 });

  const grants = await resetGrants(role);
  return NextResponse.json({ role, grants });
}
