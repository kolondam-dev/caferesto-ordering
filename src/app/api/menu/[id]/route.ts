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
  const item = await db.menuItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price !== undefined && { price: Number(body.price) }),
      ...(body.available !== undefined && { available: Boolean(body.available) }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const used = await db.orderItem.count({ where: { menuItemId: id } });
  if (used > 0) {
    await db.menuItem.update({ where: { id }, data: { available: false } });
    return NextResponse.json({ archived: true });
  }
  await db.menuItem.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
