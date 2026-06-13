"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoffeeBean, Gift, HandWaving, Users } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Spinner } from "@/components/ui";
import ConnectionBanner from "@/components/ConnectionBanner";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/Turnstile";

type Resolve = {
  table: { id: string; name: string; capacity: number };
  order: { id: string; code: string; participants: { id: string; name: string; isHost: boolean }[] } | null;
  lockedOrder: { id: string; code: string; status: string } | null;
  myParticipantId: string | null;
  myLockedOrderId: string | null;
};

/**
 * Halaman pendaratan QR meja — kesan pertama harus ramah dan ringan:
 * bukan "login", cukup berkenalan (nama; HP opsional untuk struk digital).
 */
export default function TableScanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Resolve | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tsToken, setTsToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Resolve>(`/api/qr/resolve?code=${encodeURIComponent(code)}`)
      .then((d) => {
        if (d.myParticipantId && d.order) router.replace(`/o/${d.order.id}`);
        else if (!d.order && d.myLockedOrderId) router.replace(`/o/${d.myLockedOrderId}`);
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
        body: { code, name: name.trim(), phone: phone.trim() || undefined, turnstileToken: tsToken || undefined },
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

  const firstJoin = !data.order;

  return (
    <Shell>
      <div className="w-full max-w-sm">
        <Card className="overflow-hidden">
          {/* Sapaan hangat — bukan halaman login */}
          <div className="bg-gradient-to-br from-sunset-500 via-sunset-400 to-gold-400 p-5 text-white">
            <HandWaving size={34} weight="fill" className="mb-1.5" />
            <h1 className="text-xl font-extrabold leading-snug">
              Halo! Selamat datang di {data.table.name} ✨
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Pesan langsung dari HP — <b>tanpa aplikasi, tanpa daftar, tanpa antre</b>.
            </p>
          </div>

          <div className="p-5">
            {!firstJoin && data.order!.participants.length > 0 && (
              <div className="mb-4 rounded-2xl bg-teal-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
                  <Users size={14} weight="fill" />
                  {data.order!.participants.map((p) => p.name).join(", ")} sudah mulai memilih — yuk gabung!
                </p>
                <p className="mt-2 text-[11px] text-teal-700">Pernah join tapi ganti HP? Ketuk namamu:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {data.order!.participants.map((p) => (
                    <button
                      key={p.id}
                      disabled={busy}
                      onClick={() => claim(p.id)}
                      className="rounded-full border border-teal-300 bg-white px-3 py-1 text-xs font-semibold text-teal-700"
                    >
                      Saya {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!data.order && data.lockedOrder && (
              <div className="mb-4 rounded-2xl bg-violet-50 p-3 text-xs text-violet-900">
                Pesanan sebelumnya di meja ini sedang {data.lockedOrder.status === "IN_KITCHEN" ? "disiapkan dapur" : "diproses"}.
                Form di bawah akan memulai <b>ronde pesanan baru</b>.
              </div>
            )}

            <form onSubmit={join} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-bold">Siapa nama panggilanmu?</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="cth. Budi" autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink/60">No. HP (boleh dikosongkan)</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="08xxxxxxxxxx" />
                <p className="mt-1 text-[11px] text-ink/40">Struk digital Anda dikirim ke sini jika berminat.</p>
              </div>
              <Turnstile onToken={setTsToken} />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button type="submit" variant="teal" full disabled={busy || !name.trim() || (TURNSTILE_ENABLED && !tsToken)} className="!py-3 text-base">
                <CoffeeBean size={20} weight="fill" />
                {busy ? "Sebentar ya…" : firstJoin ? "Mulai Pesan" : "Gabung & Pilih Menu"}
              </Button>
            </form>
          </div>
        </Card>

        {/* Teaser member — opsional, tidak menghalangi */}
        <Card className="mt-3 flex items-center gap-3 p-4">
          <Gift size={28} weight="fill" className="shrink-0 text-sunset-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">Sering mampir? Jadi member, gratis kok 😉</p>
            <p className="text-[11px] text-ink/50">Riwayat pesanan tersimpan, booking meja, & promo duluan.</p>
          </div>
          <a href={`/login?next=/t/${code}`} className="shrink-0 text-xs font-extrabold text-teal-700 underline">
            Daftar
          </a>
        </Card>
        <p className="mt-3 text-center text-[11px] text-ink/35">
          <a href="/" className="underline">Lihat menu tanpa scan</a>
        </p>
      </div>
      <ConnectionBanner />
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
