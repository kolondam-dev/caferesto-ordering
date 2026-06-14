import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission, can } from "@/lib/permissions";
import { needsApproval, createApproval, applyMenuUpdate, deleteMenuItem, pickMenuFields } from "@/lib/approvals";

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

  // Non-owner: perubahan menu menunggu persetujuan owner. Owner: langsung.
  if (needsApproval(guard.role)) {
    const item = await db.menuItem.findUnique({ where: { id }, select: { name: true } });
    if (!item) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
    await createApproval({
      type: "MENU_UPDATE", actor: guard, targetType: "MENU", targetId: id,
      targetLabel: item.name, payload: pickMenuFields(body),
    });
    return NextResponse.json({ pending: true, message: "Perubahan menu menunggu persetujuan owner." });
  }

  const item = await applyMenuUpdate(id, body);
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("menu.edit");
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;

  if (needsApproval(guard.role)) {
    const item = await db.menuItem.findUnique({ where: { id }, select: { name: true } });
    if (!item) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
    await createApproval({
      type: "MENU_DELETE", actor: guard, targetType: "MENU", targetId: id, targetLabel: item.name,
    });
    return NextResponse.json({ pending: true, message: "Penghapusan menu menunggu persetujuan owner." });
  }

  const res = await deleteMenuItem(id);
  return NextResponse.json(res);
}
