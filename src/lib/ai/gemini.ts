import type { ReportContext } from "./report-context";

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk owner cafe-resto "CafeResto", diakses lewat chat (gaya WhatsApp).
Jawab dalam Bahasa Indonesia, ringkas dan to the point.
Gunakan data JSON real-time yang diberikan — jangan mengarang angka.
Format jawaban dengan Markdown: gunakan tabel untuk data tabular, *bold* untuk angka penting.
Semua nominal dalam Rupiah (format Rp 1.234.567).`;

/** Panggil Gemini Flash via REST. Universal key dari Google AI Studio. */
export async function askGemini(
  question: string,
  ctx: ReportContext,
  history: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY kosong");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const contents = [
    ...history.slice(-10).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    {
      role: "user",
      parts: [{ text: `DATA REAL-TIME:\n${JSON.stringify(ctx, null, 2)}\n\nPERTANYAAN OWNER:\n${question}` }],
    },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  if (!text) throw new Error("Gemini mengembalikan jawaban kosong");
  return text;
}
