import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission, can } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const body = await req.json();
  const touchesCost = body.costPrice !== undefined;
  // Field detail (selain costPrice) butuh menu.edit; costPrice butuh menu.cost.
  const detailFields = ["name", "description", "price", "available", "categoryId", "prepMinutes"];
  const touchesDetail = detailFields.some((f) => body[f] !== undefined);

  // Minimal harus punya salah satu izin yang relevan.
  const guard = await requirePermission(touchesDetail ? "menu.edit" : "menu.cost");
  if (!isSession(guard)) return guard;
  // Bila mengubah costPrice, wajib izin menu.cost (mis. dapur tidak boleh).
  if (touchesCost && !(await can(guard.role, "menu.cost")))
    return NextResponse.json({ error: "Tidak punya izin mengubah costing" }, { status: 403 });
  if (touchesDetail && !(await can(guard.role, "menu.edit")))
    return NextResponse.json({ error: "Tidak punya izin mengubah menu" }, { status: 403 });

  const { id } = await ctx.params;
  const item = await db.menuItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price !== undefined && { price: Number(body.price) }),
      ...(body.available !== undefined && { available: Boolean(body.available) }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.prepMinutes !== undefined && { prepMinutes: body.prepMinutes ? Number(body.prepMinutes) : null }),
      ...(body.costPrice !== undefined && { costPrice: Math.max(0, Math.round(Number(body.costPrice) || 0)) }),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("menu.edit");
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
