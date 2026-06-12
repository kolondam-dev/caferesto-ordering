import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  const categories = await db.menuCategory.findMany({
    orderBy: { sort: "asc" },
    include: { items: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
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
    },
  });
  return NextResponse.json({ item });
}
