"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PaperPlaneRight, Robot, Trash, WhatsappLogo } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

type Msg = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

const SUGGESTIONS = [
  "Berapa omzet hari ini?",
  "Menu apa yang paling laris minggu ini?",
  "Ada booking apa saja hari ini?",
  "Stok bahan apa yang menipis?",
  "Utang supplier yang belum lunas?",
];

/**
 * AI Agent owner — WhatsApp di-mock sebagai chat interface dashboard.
 * Di production, endpoint /api/ai/chat yang sama tinggal dihubungkan
 * ke webhook WhatsApp Business API.
 */
export default function AIChatPage() {
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () => api<{ messages: Msg[] }>("/api/ai/chat").then((d) => setMessages(d.messages)),
    []
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [
      ...(m ?? []),
      { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    try {
      await api("/api/ai/chat", { method: "POST", body: { message } });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    if (!confirm("Hapus riwayat chat?")) return;
    await api("/api/ai/chat", { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-3xl flex-col md:h-[calc(100dvh-6rem)]">
      {/* Header ala WhatsApp */}
      <div className="flex items-center gap-3 rounded-t-2xl bg-violet-700 px-4 py-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <Robot size={22} weight="fill" />
        </div>
        <div className="flex-1">
          <p className="font-bold leading-tight">CafeResto AI Agent</p>
          <p className="flex items-center gap-1 text-[11px] text-white/70">
            <WhatsappLogo size={12} weight="fill" /> WhatsApp (mock) · Gemini Flash · online
          </p>
        </div>
        <button onClick={clear} className="text-white/70 hover:text-white">
          <Trash size={18} />
        </button>
      </div>

      {/* Percakapan */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-[#efe7dd] p-4">
        {messages === null ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <div className="mx-auto max-w-sm rounded-2xl bg-white/80 p-4 text-center text-sm text-ink/60">
            <p className="mb-3">
              Halo Owner! 👋 Tanya apa saja soal operasional cafe — omzet, booking, stok, utang supplier — saya jawab
              dengan data real-time.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`chat-md max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm md:max-w-[75%] ${
                  m.role === "user" ? "rounded-br-md bg-[#d9fdd3]" : "rounded-bl-md bg-white"
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                <p className="mt-1 text-right text-[10px] text-ink/30">
                  {new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
              <span className="inline-flex gap-1">
                <Dot /><Dot d="0.15s" /><Dot d="0.3s" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 rounded-b-2xl bg-white p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya laporan apa saja…"
          className="flex-1 rounded-full border border-sunset-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-700 text-white disabled:opacity-40"
        >
          <PaperPlaneRight size={18} weight="fill" />
        </button>
      </form>
    </div>
  );
}

function Dot({ d = "0s" }: { d?: string }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/30" style={{ animationDelay: d }} />;
}
