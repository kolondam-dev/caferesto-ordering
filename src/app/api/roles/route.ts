import { NextResponse } from "next/server";
import { isSession } from "@/lib/auth";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { PERMISSIONS, getGrants, requirePermission } from "@/lib/permissions";

/** Katalog izin + grant aktif tiap peran staf (matriks akses). */
export async function GET() {
  const guard = await requirePermission("roles.manage");
  if (!isSession(guard)) return guard;

  const grants: Record<string, string[]> = {};
  for (const role of STAFF_ROLES) grants[role] = await getGrants(role as Role);

  return NextResponse.json({ permissions: PERMISSIONS, roles: STAFF_ROLES, grants });
}
