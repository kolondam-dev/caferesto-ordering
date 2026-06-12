"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Coffee } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await api<{ user: { role: string } }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const next = params.get("next");
      router.push(next ?? (user.role === "CUSTOMER" ? "/" : "/dashboard"));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-sunset-500 text-white">
          <Coffee size={26} weight="fill" />
        </div>
        <h1 className="text-xl font-extrabold">
          <span className="text-sunset-500">Cafe</span>
          <span className="text-violet-700">Resto</span>
        </h1>
        <p className="text-sm text-ink/60">Masuk ke akun Anda</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="anda@email.com" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <Button type="submit" full disabled={loading}>
          {loading ? "Memproses…" : "Masuk"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink/60">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-sunset-600">
          Daftar
        </Link>
      </p>
      <div className="mt-4 rounded-xl bg-gold-50 p-3 text-[11px] leading-relaxed text-ink/60">
        <b>Demo:</b> owner@caferesto.id · manager@ · cashier@ · kitchen@ · customer@caferesto.id — password:{" "}
        <code>password123</code>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sunset-50 via-cream to-violet-50 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
