import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const entries = await db.journalEntry.findMany({
    orderBy: { date: "desc" },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    take: 100,
  });
  return NextResponse.json({ entries });
}

const schema = z.object({
  date: z.string().optional(),
  memo: z.string().min(1),
  lines: z
    .array(z.object({ accountId: z.string(), debit: z.number().int().min(0), credit: z.number().int().min(0) }))
    .min(2),
});

/** Jurnal manual — total debit harus sama dengan total kredit. */
export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  const totalDebit = parsed.data.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = parsed.data.lines.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit || totalDebit === 0)
    return NextResponse.json({ error: "Jurnal tidak balance (debit ≠ kredit)" }, { status: 400 });

  const entry = await db.journalEntry.create({
    data: {
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      memo: parsed.data.memo,
      lines: { create: parsed.data.lines },
    },
    include: { lines: true },
  });
  return NextResponse.json({ entry }, { status: 201 });
}
