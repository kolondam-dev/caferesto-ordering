import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  type: z.enum(["IN", "OUT", "ADJUST"]),
  qty: z.number(),
  note: z.string().optional(),
});

/** Mutasi stok: IN menambah, OUT mengurangi, ADJUST set absolut. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  const item = await db.inventoryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });

  const { type, qty, note } = parsed.data;
  let newStock = item.stock;
  if (type === "IN") newStock += qty;
  else if (type === "OUT") newStock -= qty;
  else newStock = qty;
  if (newStock < 0) return NextResponse.json({ error: "Stok tidak boleh negatif" }, { status: 400 });

  const [movement] = await db.$transaction([
    db.stockMovement.create({ data: { itemId: id, type, qty, note } }),
    db.inventoryItem.update({ where: { id }, data: { stock: newStock } }),
  ]);
  return NextResponse.json({ movement, stock: newStock }, { status: 201 });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const movements = await db.stockMovement.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ movements });
}
