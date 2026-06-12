import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

/** Chart of accounts + saldo berjalan (trial balance sederhana). */
export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const accounts = await db.account.findMany({ orderBy: { code: "asc" }, include: { lines: true } });
  const withBalance = accounts.map((a) => {
    const debit = a.lines.reduce((s, l) => s + l.debit, 0);
    const credit = a.lines.reduce((s, l) => s + l.credit, 0);
    const normalDebit = a.type === "ASSET" || a.type === "EXPENSE";
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debit,
      credit,
      balance: normalDebit ? debit - credit : credit - debit,
    };
  });
  return NextResponse.json({ accounts: withBalance });
}

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
});

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const account = await db.account.create({ data: parsed.data });
  return NextResponse.json({ account }, { status: 201 });
}
