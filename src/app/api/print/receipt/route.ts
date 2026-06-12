import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { STAFF_ROLES, formatIDR } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { getOrderDue } from "@/lib/payments/settle";
import { EscPosBuilder, sendToPrinter } from "@/lib/print/escpos";

const W = 32; // lebar karakter kertas 58mm; ganti 48 untuk 80mm

/**
 * Cetak struk langsung ke thermal printer jaringan (ESC/POS, port RAW).
 * Konfigurasi host/port di Dashboard → Pengaturan.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId kosong" }, { status: 400 });

  const settings = await getSettings();
  if (!settings.printerHost)
    return NextResponse.json(
      { error: "Printer belum dikonfigurasi — isi host printer di Pengaturan" },
      { status: 400 }
    );

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { table: true, items: true, payments: true },
  });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  const bill = await getOrderDue(orderId);

  const r = new EscPosBuilder();
  r.align("center").doubleSize(true).line(settings.cafeName).doubleSize(false);
  r.line(`${order.table?.name ?? "Takeaway"} - ${order.code}`);
  r.line(new Date(order.closedAt ?? order.createdAt).toLocaleString("id-ID"));
  r.align("left").divider(W);
  for (const i of order.items.filter((x) => x.status !== "CANCELED")) {
    r.row(`${i.qty}x ${i.nameSnapshot}`, formatIDR(i.price * i.qty).replace(/ /g, " "), W);
  }
  r.divider(W);
  const money = (n: number) => formatIDR(n).replace(/ /g, " ");
  r.row("Subtotal", money(bill.subtotal), W);
  if (bill.serviceFee > 0) r.row("Service fee", money(bill.serviceFee), W);
  r.row("Pajak", money(bill.tax), W);
  if (bill.deposit > 0) r.row("Deposit", `-${money(bill.deposit)}`, W);
  r.bold(true).row("TOTAL", money(bill.total - bill.deposit), W).bold(false);
  r.divider(W);
  r.align("center").bold(true).line(bill.due <= 0 ? "*** LUNAS ***" : `SISA: ${money(bill.due)}`).bold(false);
  r.line("Terima kasih sudah mampir!");
  r.feed(3).cut();

  try {
    await sendToPrinter(settings.printerHost, settings.printerPort, r.build());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  return NextResponse.json({ printed: true });
}
