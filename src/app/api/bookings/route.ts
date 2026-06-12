import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { runBookingLifecycle } from "@/lib/lifecycle";
import { shortCode } from "@/lib/code";
import { STAFF_ROLES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;
  await runBookingLifecycle();

  const mineOnly = !STAFF_ROLES.includes(guard.role);
  const bookings = await db.booking.findMany({
    where: mineOnly ? { customerId: guard.sub } : {},
    orderBy: { scheduledAt: "desc" },
    include: { table: true, customer: { select: { name: true, email: true } }, order: { select: { id: true, code: true, status: true } } },
    take: 100,
  });
  return NextResponse.json({ bookings });
}

const createSchema = z.object({
  tableId: z.string(),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string()),
  partySize: z.number().int().min(1).max(50),
});

export async function POST(req: NextRequest) {
  const guard = await requireRole();
  if (!isSession(guard)) return guard;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Data booking tidak valid" }, { status: 400 });

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())
    return NextResponse.json({ error: "Jadwal harus di masa depan" }, { status: 400 });

  const table = await db.table.findUnique({ where: { id: parsed.data.tableId } });
  if (!table) return NextResponse.json({ error: "Meja tidak ditemukan" }, { status: 404 });
  if (parsed.data.partySize > table.capacity)
    return NextResponse.json({ error: `Kapasitas ${table.name} hanya ${table.capacity} orang` }, { status: 400 });

  // Tolak bila ada booking aktif lain di meja yang sama dalam rentang ±2 jam
  const windowMs = 2 * 3600_000;
  const clash = await db.booking.findFirst({
    where: {
      tableId: table.id,
      status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
      scheduledAt: {
        gte: new Date(scheduledAt.getTime() - windowMs),
        lte: new Date(scheduledAt.getTime() + windowMs),
      },
    },
  });
  if (clash)
    return NextResponse.json({ error: "Meja sudah dibooking pada rentang waktu tersebut" }, { status: 409 });

  const settings = await getSettings();
  // Batas bayar fee = H-x sebelum jadwal; bila booking dibuat di dalam jendela H-x,
  // beri waktu 2 jam (atau sampai jadwal, mana yang lebih dulu).
  const hMinusX = new Date(scheduledAt.getTime() - settings.bookingConfirmDays * 86400_000);
  const now = new Date();
  const payDeadlineAt =
    hMinusX > now ? hMinusX : new Date(Math.min(scheduledAt.getTime(), now.getTime() + 2 * 3600_000));

  const booking = await db.booking.create({
    data: {
      code: shortCode("BK"),
      customerId: guard.sub,
      tableId: table.id,
      partySize: parsed.data.partySize,
      scheduledAt,
      payDeadlineAt,
      feeAmount: settings.bookingFeeAmount,
    },
    include: { table: true },
  });
  return NextResponse.json({ booking }, { status: 201 });
}
