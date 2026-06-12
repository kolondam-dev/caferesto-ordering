"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Users } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

type Resolve = {
  table: { id: string; name: string; capacity: number };
  order: { id: string; code: string; participants: { id: string; name: string; isHost: boolean }[] } | null;
  myParticipantId: string | null;
};

/**
 * Halaman pendaratan QR meja — jalur utama pemesanan (Scan & Serve).
 * Tanpa login: cukup nama (+ HP opsional untuk struk digital).
 */
export default function TableScanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Resolve | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Resolve>(`/api/qr/resolve?code=${encodeURIComponent(code)}`)
      .then((d) => {
        if (d.myParticipantId && d.order) router.replace(`/o/${d.order.id}`);
        else setData(d);
      })
      .catch((e) => setError(e.message));
  }, [code, router]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ orderId: string }>("/api/qr/join", {
        method: "POST",
        body: { code, name: name.trim(), phone: phone.trim() || undefined },
      });
      router.replace(`/o/${res.orderId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function claim(participantId: string) {
    setBusy(true);
    try {
      const res = await api<{ orderId: string }>("/api/qr/join", {
        method: "POST",
        body: { code, claimParticipantId: participantId },
      });
      router.replace(`/o/${res.orderId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (error && !data)
    return (
      <Shell>
        <Card className="w-full max-w-sm p-6 text-center">
          <p className="font-bold text-red-600">{error}</p>
          <p className="mt-2 text-sm text-ink/50">Pastikan QR yang Anda scan masih berlaku.</p>
        </Card>
      </Shell>
    );
  if (!data)
    return (
      <Shell>
        <Spinner />
      </Shell>
    );

  return (
    <Shell>
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-sunset-500 text-white">
            <QrCode size={26} weight="fill" />
          </div>
          <h1 className="text-xl font-extrabold">{data.table.name}</h1>
          <p className="flex items-center justify-center gap-1 text-sm text-ink/50">
            <Users size={14} /> kapasitas {data.table.capacity} orang
          </p>
        </div>

        {data.order && data.order.participants.length > 0 && (
          <div className="mb-4 rounded-xl bg-violet-50 p-3">
            <p className="text-xs font-semibold text-violet-900">
              Sudah ada pesanan berjalan di meja ini — Anda akan bergabung dengan:
            </p>
            <p className="mt-1 text-sm font-bold text-violet-900">
              {data.order.participants.map((p) => p.name).join(", ")}
            </p>
            <p className="mt-2 text-[11px] text-violet-700">Pernah join tapi ganti perangkat? Klaim nama Anda:</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.order.participants.map((p) => (
                <button
                  key={p.id}
                  disabled={busy}
                  onClick={() => claim(p.id)}
                  className="rounded-full border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-700"
                >
                  Saya {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={join} className="space-y-3">
          <div>
            <Label>Nama Anda</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="cth. Budi" />
          </div>
          <div>
            <Label>No. HP (opsional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="08xxxxxxxxxx" />
            <p className="mt-1 text-[11px] text-ink/40">Struk digital Anda dikirim ke sini jika berminat.</p>
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <Button type="submit" full disabled={busy || !name.trim()}>
            {busy ? "Memproses…" : data.order ? "Gabung Pesanan" : "Mulai Pesan"}
          </Button>
        </form>
        <p className="mt-4 text-center text-[11px] text-ink/35">
          Tanpa scan QR?{" "}
          <a href="/" className="underline">
            pesan lewat menu biasa
          </a>
        </p>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sunset-50 via-cream to-violet-50 p-4">
      {children}
    </div>
  );
}
