import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ photoId: string }> };

/** Jadikan foto utama (foto utama lama otomatis diturunkan). */
export async function PATCH(_req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("menu.edit");
  if (!isSession(guard)) return guard;
  const { photoId } = await ctx.params;

  const photo = await db.menuPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return NextResponse.json({ error: "Foto tidak ditemukan" }, { status: 404 });

  await db.$transaction([
    db.menuPhoto.updateMany({ where: { menuItemId: photo.menuItemId }, data: { isPrimary: false } }),
    db.menuPhoto.update({ where: { id: photoId }, data: { isPrimary: true } }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("menu.edit");
  if (!isSession(guard)) return guard;
  const { photoId } = await ctx.params;

  const photo = await db.menuPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return NextResponse.json({ error: "Foto tidak ditemukan" }, { status: 404 });

  await db.menuPhoto.delete({ where: { id: photoId } });
  // Bila foto utama dihapus, angkat foto berikutnya
  if (photo.isPrimary) {
    const next = await db.menuPhoto.findFirst({
      where: { menuItemId: photo.menuItemId },
      orderBy: { sort: "asc" },
    });
    if (next) await db.menuPhoto.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  return NextResponse.json({ deleted: true });
}
