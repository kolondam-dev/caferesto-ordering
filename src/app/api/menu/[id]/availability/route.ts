import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Toggle ketersediaan menu (sold out / ready). Diatur izin menu.availability
 * — terpisah dari edit menu penuh (menu.edit). Dapur memilikinya secara default.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("menu.availability");
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const { available } = (await req.json().catch(() => ({}))) as { available?: boolean };
  if (typeof available !== "boolean")
    return NextResponse.json({ error: "Field 'available' wajib boolean" }, { status: 400 });

  const item = await db.menuItem.update({ where: { id }, data: { available } });
  return NextResponse.json({ item: { id: item.id, available: item.available } });
}
