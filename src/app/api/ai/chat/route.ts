import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, isSession } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { buildReportContext, mockAnswer } from "@/lib/ai/report-context";
import { askGemini } from "@/lib/ai/gemini";

/**
 * AI Agent untuk owner — di production terhubung WhatsApp Business API;
 * di sini WhatsApp di-mock sebagai chat interface dashboard.
 */
export async function GET() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const messages = await db.chatMessage.findMany({
    where: { userId: guard.sub },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  const { message } = (await req.json()) as { message?: string };
  if (!message?.trim()) return NextResponse.json({ error: "Pesan kosong" }, { status: 400 });

  const history = await db.chatMessage.findMany({
    where: { userId: guard.sub },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  await db.chatMessage.create({ data: { userId: guard.sub, role: "user", content: message } });

  const ctx = await buildReportContext();
  let answer: string;
  if (process.env.GEMINI_API_KEY) {
    try {
      answer = await askGemini(message, ctx, history.reverse());
    } catch (e) {
      answer = `⚠️ Gagal menghubungi Gemini (${(e as Error).message}). Jawaban mode mock:\n\n${mockAnswer(message, ctx)}`;
    }
  } else {
    answer = mockAnswer(message, ctx);
  }

  const saved = await db.chatMessage.create({
    data: { userId: guard.sub, role: "assistant", content: answer },
  });
  return NextResponse.json({ message: saved });
}

export async function DELETE() {
  const guard = await requireRole(ADMIN_ROLES);
  if (!isSession(guard)) return guard;
  await db.chatMessage.deleteMany({ where: { userId: guard.sub } });
  return NextResponse.json({ ok: true });
}
