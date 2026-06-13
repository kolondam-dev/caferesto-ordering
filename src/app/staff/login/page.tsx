"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKey } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label } from "@/components/ui";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/Turnstile";

/** Login staff/backoffice (OWNER, MANAGER, CASHIER, KITCHEN) — email + password. */
function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tsToken, setTsToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await api<{ user: { role: string } }>("/api/auth/login", {
        method: "POST",
        body: { email, password, turnstileToken: tsToken || undefined },
      });
      if (user.role === "CUSTOMER") {
        setError("Akun ini bukan akun staff. Customer silakan masuk lewat halaman utama.");
        setLoading(false);
        return;
      }
      router.push(params.get("next") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-700 text-white">
            <LockKey size={26} weight="fill" />
          </div>
          <h1 className="text-xl font-extrabold">Login Staff</h1>
          <p className="text-sm text-ink/60">Owner · Manager · Kasir · Dapur</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="staff@caferesto.id" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <Turnstile onToken={setTsToken} />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <Button type="submit" variant="secondary" full disabled={loading || (TURNSTILE_ENABLED && !tsToken)}>
            {loading ? "Memproses…" : "Masuk"}
          </Button>
        </form>
        <p className="mt-4 text-center text-[11px] text-ink/40">
          Customer? <a href="/login" className="font-semibold text-sunset-600">Masuk di sini</a>
        </p>
      </Card>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense>
      <StaffLoginForm />
    </Suspense>
  );
}
