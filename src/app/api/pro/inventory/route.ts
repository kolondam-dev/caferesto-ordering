import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const items = await db.inventoryItem.findMany({
    orderBy: { name: "asc" },
    include: { supplier: { select: { name: true } }, movements: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return NextResponse.json({ items });
}

const schema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().default("pcs"),
  stock: z.number().default(0),
  minStock: z.number().default(0),
  costPrice: z.number().int().default(0),
  supplierId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const item = await db.inventoryItem.create({ data: parsed.data });
  if (item.stock > 0)
    await db.stockMovement.create({ data: { itemId: item.id, type: "IN", qty: item.stock, note: "Stok awal" } });
  return NextResponse.json({ item }, { status: 201 });
}
