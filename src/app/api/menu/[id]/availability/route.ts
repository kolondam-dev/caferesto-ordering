import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Toggle ketersediaan menu (sold out / ready). Boleh oleh seluruh staff
 * (termasuk KASIR) — terpisah dari edit menu penuh yang khusus admin.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const { available } = (await req.json().catch(() => ({}))) as { available?: boolean };
  if (typeof available !== "boolean")
    return NextResponse.json({ error: "Field 'available' wajib boolean" }, { status: 400 });

  const item = await db.menuItem.update({ where: { id }, data: { available } });
  return NextResponse.json({ item: { id: item.id, available: item.available } });
}
