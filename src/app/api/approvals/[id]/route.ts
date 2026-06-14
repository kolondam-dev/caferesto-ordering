import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { applyApproval } from "@/lib/approvals";

type Ctx = { params: Promise<{ id: string }> };

/** Setujui / tolak permintaan. body: { decision: "approve"|"reject", note? } */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("approvals.review");
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string };

  const reqRow = await db.approvalRequest.findUnique({ where: { id } });
  if (!reqRow) return NextResponse.json({ error: "Permintaan tidak ditemukan" }, { status: 404 });
  if (reqRow.status !== "PENDING")
    return NextResponse.json({ error: "Permintaan sudah diproses" }, { status: 400 });

  if (body.decision === "reject") {
    await db.approvalRequest.update({
      where: { id },
      data: { status: "REJECTED", decidedById: guard.sub, decidedAt: new Date(), decisionNote: body.note ?? null },
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  if (body.decision !== "approve")
    return NextResponse.json({ error: "decision harus approve atau reject" }, { status: 400 });

  // Jalankan efek; bila kondisi sudah berubah (mis. order tak lagi OPEN), gagal.
  const res = await applyApproval(reqRow);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Gagal mengeksekusi" }, { status: 400 });

  await db.approvalRequest.update({
    where: { id },
    data: { status: "APPROVED", decidedById: guard.sub, decidedAt: new Date(), decisionNote: body.note ?? null },
  });
  return NextResponse.json({ ok: true, status: "APPROVED" });
}
