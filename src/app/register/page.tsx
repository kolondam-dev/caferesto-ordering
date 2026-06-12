"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Card, Input, Label } from "@/components/ui";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/register", { method: "POST", body: form });
      router.push(params.get("next") ?? "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-xl font-extrabold">Jadi Member CafeResto</h1>
      <p className="mb-4 mt-1 text-sm text-ink/55">
        Gratis & 30 detik — riwayat pesanan tersimpan, bisa booking meja, dan dapat promo duluan. ☕
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Nama</Label>
          <Input value={form.name} onChange={set("name")} required placeholder="Nama lengkap" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={set("email")} required placeholder="anda@email.com" />
        </div>
        <div>
          <Label>No. HP (opsional)</Label>
          <Input value={form.phone} onChange={set("phone")} placeholder="08xxxxxxxxxx" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={form.password} onChange={set("password")} required minLength={6} placeholder="Minimal 6 karakter" />
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <Button type="submit" variant="teal" full disabled={loading}>
          {loading ? "Memproses…" : "Daftar Gratis"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-ink/60">
        Sudah punya akun?{" "}
        <Link href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-semibold text-sunset-600">
          Masuk
        </Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sunset-50 via-cream to-violet-50 p-4">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
