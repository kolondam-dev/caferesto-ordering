"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Card, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/register", { method: "POST", body: form });
      router.push("/");
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
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sunset-50 via-cream to-violet-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-4 text-xl font-extrabold">Daftar Akun</h1>
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
          <Button type="submit" full disabled={loading}>
            {loading ? "Memproses…" : "Daftar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink/60">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-sunset-600">
            Masuk
          </Link>
        </p>
      </Card>
    </div>
  );
}
