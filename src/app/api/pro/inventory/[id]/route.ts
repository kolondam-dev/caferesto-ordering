import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json();
  const item = await db.inventoryItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.minStock !== undefined && { minStock: Number(body.minStock) }),
      ...(body.costPrice !== undefined && { costPrice: Number(body.costPrice) }),
      ...(body.supplierId !== undefined && { supplierId: body.supplierId || null }),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  await db.stockMovement.deleteMany({ where: { itemId: id } });
  await db.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
