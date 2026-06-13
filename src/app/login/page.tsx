"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatCircleDots, Coffee } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label } from "@/components/ui";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/Turnstile";

/**
 * Login/registrasi customer — cukup nama + no HP, lalu verifikasi kode WhatsApp.
 * Identitas berbasis no HP; sekali masuk, cookie bertahan lama (90 hari).
 */
function CustomerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") ?? "/";

  const [step, setStep] = useState<"identity" | "otp">("identity");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tsToken, setTsToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ devCode?: string }>("/api/auth/customer/request", {
        method: "POST",
        body: { name: name.trim(), phone: phone.trim(), turnstileToken: tsToken || undefined },
      });
      setDevCode(res.devCode ?? null);
      setStep("otp");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/customer/verify", { method: "POST", body: { phone: phone.trim(), code: code.trim() } });
      router.push(nextUrl);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sunset-50 via-cream to-violet-50 p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-br from-sunset-500 via-sunset-400 to-gold-400 p-5 text-white">
          <Coffee size={32} weight="fill" className="mb-1.5" />
          <h1 className="text-xl font-extrabold">
            Selamat datang di <span className="text-white">CafeResto</span> ☕
          </h1>
          <p className="mt-1 text-sm text-white/90">
            Masuk cukup dengan nama & no HP — kami kirim kode lewat WhatsApp.
          </p>
        </div>

        <div className="p-5">
          {step === "identity" ? (
            <form onSubmit={requestOtp} className="space-y-3">
              <div>
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="cth. Budi" autoFocus />
              </div>
              <div>
                <Label>No. WhatsApp</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="08xxxxxxxxxx" inputMode="numeric" />
              </div>
              <Turnstile onToken={setTsToken} />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button type="submit" variant="teal" full disabled={busy || !name.trim() || !phone.trim() || (TURNSTILE_ENABLED && !tsToken)}>
                <ChatCircleDots size={18} weight="fill" /> {busy ? "Mengirim…" : "Kirim Kode WhatsApp"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <p className="text-sm text-ink/60">
                Masukkan 6 digit kode yang kami kirim ke WhatsApp <b>{phone}</b>.
              </p>
              {devCode && (
                <p className="rounded-xl bg-gold-50 p-2 text-center text-xs text-gold-800">
                  Mode demo — kode Anda: <b className="tracking-widest">{devCode}</b>
                </p>
              )}
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                inputMode="numeric"
                placeholder="• • • • • •"
                className="text-center text-lg tracking-[0.4em]"
                autoFocus
              />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button type="submit" variant="teal" full disabled={busy || code.trim().length < 4}>
                {busy ? "Memverifikasi…" : "Masuk"}
              </Button>
              <button type="button" onClick={() => { setStep("identity"); setCode(""); setError(""); }} className="w-full text-center text-xs font-semibold text-ink/50">
                ← Ganti nama / nomor
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-[11px] text-ink/35">
            Staff cafe? <a href="/staff/login" className="font-semibold text-violet-700">Login di sini</a>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense>
      <CustomerLoginForm />
    </Suspense>
  );
}
