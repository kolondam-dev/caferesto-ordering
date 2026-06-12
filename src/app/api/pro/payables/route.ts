import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const payables = await db.payable.findMany({
    orderBy: { dueDate: "asc" },
    include: { supplier: { select: { name: true } } },
  });
  return NextResponse.json({ payables });
}

const schema = z.object({
  supplierId: z.string(),
  invoiceNo: z.string().min(1),
  amount: z.number().int().positive(),
  dueDate: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const payable = await db.payable.create({
    data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate) },
  });
  return NextResponse.json({ payable }, { status: 201 });
}
