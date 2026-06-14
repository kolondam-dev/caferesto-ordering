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

  if (body.decision !== "approve" && body.decision !== "reject")
    return NextResponse.json({ error: "decision harus approve atau reject" }, { status: 400 });

  const decision = { decidedById: guard.sub, decidedAt: new Date(), decisionNote: body.note ?? null };

  // Klaim atomik: hanya satu reviewer yang menang bila dua menekan bersamaan,
  // sehingga efek tidak dieksekusi ganda.
  const claimed = await db.approvalRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: body.decision === "reject" ? "REJECTED" : "APPROVED", ...decision },
  });
  if (claimed.count === 0)
    return NextResponse.json({ error: "Permintaan sudah diproses" }, { status: 400 });

  if (body.decision === "reject")
    return NextResponse.json({ ok: true, status: "REJECTED" });

  // Sudah diklaim APPROVED; jalankan efeknya. Bila kondisi telah berubah
  // (mis. order tak lagi OPEN), kembalikan ke PENDING agar bisa ditinjau ulang.
  const res = await applyApproval(reqRow);
  if (!res.ok) {
    await db.approvalRequest.update({
      where: { id },
      data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null },
    });
    return NextResponse.json({ error: res.error ?? "Gagal mengeksekusi" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: "APPROVED" });
}
