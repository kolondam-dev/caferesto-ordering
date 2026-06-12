import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, payables: true } } },
  });
  return NextResponse.json({ suppliers });
}

const schema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const supplier = await db.supplier.create({ data: { ...parsed.data, email: parsed.data.email || null } });
  return NextResponse.json({ supplier }, { status: 201 });
}
