import { NextResponse } from "next/server";
import { runBookingLifecycle } from "@/lib/lifecycle";

/** Endpoint cron/manual untuk menjalankan lifecycle booking. */
export async function POST() {
  const result = await runBookingLifecycle();
  return NextResponse.json(result);
}

export async function GET() {
  const result = await runBookingLifecycle();
  return NextResponse.json(result);
}
