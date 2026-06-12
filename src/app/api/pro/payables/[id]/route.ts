import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/**
 * action "pay": catat pembayaran utang supplier sebagian/lunas.
 * Otomatis membuat jurnal: Debit Utang Usaha (2000), Kredit Kas (1000).
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json();

  const payable = await db.payable.findUnique({ where: { id }, include: { supplier: true } });
  if (!payable) return NextResponse.json({ error: "Payable tidak ditemukan" }, { status: 404 });

  if (body.action === "pay") {
    const amount = Number(body.amount);
    const remaining = payable.amount - payable.paidAmount;
    if (!amount || amount <= 0 || amount > remaining)
      return NextResponse.json({ error: `Nominal harus 1..${remaining}` }, { status: 400 });

    const newPaid = payable.paidAmount + amount;
    const status = newPaid >= payable.amount ? "PAID" : "PARTIAL";

    const [ap, cash] = await Promise.all([
      db.account.findUnique({ where: { code: "2000" } }),
      db.account.findUnique({ where: { code: "1000" } }),
    ]);
    await db.$transaction(async (tx) => {
      await tx.payable.update({ where: { id }, data: { paidAmount: newPaid, status } });
      if (ap && cash) {
        await tx.journalEntry.create({
          data: {
            memo: `Bayar utang ${payable.supplier.name} inv ${payable.invoiceNo}`,
            refType: "PAYABLE",
            refId: payable.id,
            lines: {
              create: [
                { accountId: ap.id, debit: amount, credit: 0 },
                { accountId: cash.id, debit: 0, credit: amount },
              ],
            },
          },
        });
      }
    });
    const updated = await db.payable.findUnique({ where: { id }, include: { supplier: true } });
    return NextResponse.json({ payable: updated });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  await db.payable.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
