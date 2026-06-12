import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const periods = await db.payrollPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: { payslips: { include: { user: { select: { name: true, role: true } } } } },
  });
  return NextResponse.json({ periods });
}

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
});

/**
 * Buat periode payroll + generate payslip draft untuk semua staff bergaji
 * (baseSalary > 0) dari master User.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  const staff = await db.user.findMany({ where: { baseSalary: { gt: 0 } } });
  const period = await db.payrollPeriod.create({
    data: {
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      payslips: {
        create: staff.map((u) => ({
          userId: u.id,
          baseSalary: u.baseSalary,
          netPay: u.baseSalary,
        })),
      },
    },
    include: { payslips: { include: { user: { select: { name: true, role: true } } } } },
  });
  return NextResponse.json({ period }, { status: 201 });
}
