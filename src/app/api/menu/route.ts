import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  const categories = await db.menuCategory.findMany({
    orderBy: { sort: "asc" },
    include: {
      items: {
        orderBy: { name: "asc" },
        include: { photos: { orderBy: [{ isPrimary: "desc" }, { sort: "asc" }] } },
      },
    },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission("menu.edit");
  if (!isSession(guard)) return guard;

  const body = await req.json();
  if (body.kind === "category") {
    const cat = await db.menuCategory.create({ data: { name: body.name, sort: body.sort ?? 0 } });
    return NextResponse.json({ category: cat });
  }
  const item = await db.menuItem.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      price: Number(body.price),
      categoryId: body.categoryId,
      available: body.available ?? true,
      prepMinutes: body.prepMinutes ? Number(body.prepMinutes) : null,
    },
  });
  return NextResponse.json({ item });
}
