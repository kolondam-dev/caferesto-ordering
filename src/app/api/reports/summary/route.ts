import { NextResponse } from "next/server";
import { requireRole, isSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";
import { buildReportContext } from "@/lib/ai/report-context";

export async function GET() {
  const guard = await requireRole(STAFF_ROLES);
  if (!isSession(guard)) return guard;
  return NextResponse.json({ report: await buildReportContext() });
}
