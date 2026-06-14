import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { safeJson } from "@/lib/approvals";

/** Daftar permintaan persetujuan. Default PENDING; ?status=ALL untuk semua. */
export async function GET(req: NextRequest) {
  const guard = await requirePermission("approvals.review");
  if (!isSession(guard)) return guard;

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const where = status === "ALL" ? {} : { status };

  const items = await db.approvalRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { decidedBy: { select: { name: true } } },
  });

  const requests = items.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    requestedName: r.requestedName,
    targetType: r.targetType,
    targetId: r.targetId,
    targetLabel: r.targetLabel,
    reason: r.reason,
    payload: safeJson(r.payload),
    decidedBy: r.decidedBy?.name ?? null,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt,
    createdAt: r.createdAt,
  }));

  const pendingCount = await db.approvalRequest.count({ where: { status: "PENDING" } });
  return NextResponse.json({ requests, pendingCount });
}
