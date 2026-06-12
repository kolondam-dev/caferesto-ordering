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
  const supplier = await db.supplier.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.contact !== undefined && { contact: body.contact }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.address !== undefined && { address: body.address }),
    },
  });
  return NextResponse.json({ supplier });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const linked = await db.payable.count({ where: { supplierId: id } });
  if (linked > 0)
    return NextResponse.json({ error: "Supplier punya payable, tidak bisa dihapus" }, { status: 400 });
  await db.inventoryItem.updateMany({ where: { supplierId: id }, data: { supplierId: null } });
  await db.supplier.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
