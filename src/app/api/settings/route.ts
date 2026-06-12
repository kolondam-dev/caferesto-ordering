import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const body = await req.json();
  const allowed = ["bookingConfirmDays", "bookingFeeAmount", "bookingGraceMinutes", "taxPercent", "cafeName"];
  const patch: Record<string, string | number> = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  await saveSettings(patch);
  return NextResponse.json({ settings: await getSettings() });
}
