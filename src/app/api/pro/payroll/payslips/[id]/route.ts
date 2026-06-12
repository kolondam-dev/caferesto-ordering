import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Update payslip: ubah allowance/deduction (netPay dihitung ulang),
 * atau action "pay" → tandai dibayar + jurnal Beban Gaji (5100) vs Kas (1000).
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = await req.json();

  const slip = await db.payslip.findUnique({ where: { id }, include: { user: true } });
  if (!slip) return NextResponse.json({ error: "Payslip tidak ditemukan" }, { status: 404 });

  if (body.action === "pay") {
    if (slip.status === "PAID") return NextResponse.json({ error: "Sudah dibayar" }, { status: 400 });
    const [expense, cash] = await Promise.all([
      db.account.findUnique({ where: { code: "5100" } }),
      db.account.findUnique({ where: { code: "1000" } }),
    ]);
    await db.$transaction(async (tx) => {
      await tx.payslip.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
      if (expense && cash) {
        await tx.journalEntry.create({
          data: {
            memo: `Gaji ${slip.user.name}`,
            refType: "PAYSLIP",
            refId: slip.id,
            lines: {
              create: [
                { accountId: expense.id, debit: slip.netPay, credit: 0 },
                { accountId: cash.id, debit: 0, credit: slip.netPay },
              ],
            },
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  }

  const allowance = body.allowance !== undefined ? Number(body.allowance) : slip.allowance;
  const deduction = body.deduction !== undefined ? Number(body.deduction) : slip.deduction;
  const updated = await db.payslip.update({
    where: { id },
    data: { allowance, deduction, netPay: slip.baseSalary + allowance - deduction },
  });
  return NextResponse.json({ payslip: updated });
}
