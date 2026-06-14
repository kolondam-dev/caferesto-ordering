import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGrants } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null, permissions: [] });
  const permissions = await getGrants(session.role);
  return NextResponse.json({ user: session, permissions });
}
